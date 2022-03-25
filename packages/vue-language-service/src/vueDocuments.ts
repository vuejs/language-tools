import { VueFiles, VueFile, EmbeddedFile, EmbeddedFileSourceMap, Teleport, Embedded, localTypes } from '@volar/vue-typescript';
import * as shared from '@volar/shared';
import { computed } from '@vue/reactivity';
import { SourceMapBase, Mapping } from '@volar/source-map';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { EmbeddedFileMappingData, TeleportMappingData, TeleportSideData } from '@volar/vue-code-gen';
import { untrack } from './utils/untrack';
import type * as vscode from 'vscode-languageserver-protocol';

import type * as _ from '@volar/vue-typescript/node_modules/@vue/reactivity'; // fix build error

export type VueDocuments = ReturnType<typeof parseVueDocuments>;
export type VueDocument = ReturnType<typeof parseVueDocument>;

export class SourceMap<Data = undefined> extends SourceMapBase<Data> {

    constructor(
        public sourceDocument: TextDocument,
        public mappedDocument: TextDocument,
        public _mappings?: Mapping<Data>[],
    ) {
        super(_mappings);
    }

    public getSourceRange<T extends number | vscode.Position>(start: T, end?: T, filter?: (data: Data) => boolean) {
        for (const mapped of this.getRanges(start, end ?? start, false, filter)) {
            return mapped;
        }
    }
    public getMappedRange<T extends number | vscode.Position>(start: T, end?: T, filter?: (data: Data) => boolean) {
        for (const mapped of this.getRanges(start, end ?? start, true, filter)) {
            return mapped;
        }
    }
    public getSourceRanges<T extends number | vscode.Position>(start: T, end?: T, filter?: (data: Data) => boolean) {
        return this.getRanges(start, end ?? start, false, filter);
    }
    public getMappedRanges<T extends number | vscode.Position>(start: T, end?: T, filter?: (data: Data) => boolean) {
        return this.getRanges(start, end ?? start, true, filter);
    }

    protected * getRanges<T extends number | vscode.Position>(start: T, end: T, sourceToTarget: boolean, filter?: (data: Data) => boolean) {

        const startIsNumber = typeof start === 'number';
        const endIsNumber = typeof end === 'number';

        const toDoc = sourceToTarget ? this.mappedDocument : this.sourceDocument;
        const fromDoc = sourceToTarget ? this.sourceDocument : this.mappedDocument;
        const startOffset = startIsNumber ? start : fromDoc.offsetAt(start);
        const endOffset = endIsNumber ? end : fromDoc.offsetAt(end);

        for (const mapped of super.getRanges(startOffset, endOffset, sourceToTarget, filter)) {
            yield getMapped(mapped);
        }

        function getMapped(mapped: [{ start: number, end: number }, Data]): [{ start: T, end: T }, Data] {
            if (startIsNumber) {
                return mapped as [{ start: T, end: T }, Data];
            }
            return [{
                start: toDoc.positionAt(mapped[0].start) as T,
                end: toDoc.positionAt(mapped[0].end) as T,
            }, mapped[1]];
        }
    }
}

export class EmbeddedDocumentSourceMap extends SourceMap<EmbeddedFileMappingData> {

    constructor(
        public embeddedFile: EmbeddedFile,
        public sourceDocument: TextDocument,
        public mappedDocument: TextDocument,
        _sourceMap: EmbeddedFileSourceMap,
    ) {
        super(sourceDocument, mappedDocument, _sourceMap.mappings);
    }
}

export class TeleportSourceMap extends SourceMap<TeleportMappingData> {
    constructor(
        public embeddedFile: EmbeddedFile,
        public document: TextDocument,
        teleport: Teleport,
    ) {
        super(document, document, teleport.mappings);
    }
    *findTeleports(start: vscode.Position, end?: vscode.Position, filter?: (data: TeleportSideData) => boolean) {
        for (const [teleRange, data] of this.getMappedRanges(start, end, filter ? data => filter(data.toTarget) : undefined)) {
            yield [teleRange, data.toTarget] as const;
        }
        for (const [teleRange, data] of this.getSourceRanges(start, end, filter ? data => filter(data.toSource) : undefined)) {
            yield [teleRange, data.toSource] as const;
        }
    }
}

export function parseVueDocuments(vueFiles: VueFiles) {

    // cache map
    const vueDocuments = useCacheMap<VueFile, VueDocument>(vueFile => {
        return parseVueDocument(vueFile);
    });

    // reactivity
    const embeddedDocumentsMap = computed(() => {
        const map = new Map<TextDocument, VueDocument>();
        for (const vueDocument of getAll()) {
            for (const sourceMap of vueDocument.refs.sourceMaps.value) {
                map.set(sourceMap.mappedDocument, vueDocument);
            }
        }
        return map;
    });
    const embeddedDocumentsMapLsType = computed(() => {
        const maps = {
            nonTs: new Map<string, EmbeddedDocumentSourceMap>(),
            script: new Map<string, EmbeddedDocumentSourceMap>(),
            template: new Map<string, EmbeddedDocumentSourceMap>(),
        };
        for (const vueDocument of getAll()) {
            for (const sourceMap of vueDocument.refs.sourceMaps.value) {
                maps[sourceMap.embeddedFile.lsType].set(sourceMap.mappedDocument.uri, sourceMap);
            }
        }
        return maps;
    });
    const teleportsMapLsType = computed(() => {
        const maps = {
            nonTs: new Map<string, TeleportSourceMap>(),
            script: new Map<string, TeleportSourceMap>(),
            template: new Map<string, TeleportSourceMap>(),
        };
        for (const vueDocument of getAll()) {
            for (const teleport of vueDocument.refs.teleports.value) {
                maps[teleport.embeddedFile.lsType].set(teleport.mappedDocument.uri, teleport);
            }
        }
        return maps;
    });

    return {
        getAll: untrack(getAll),
        get: untrack((uri: string) => {

            const fileName = shared.uriToFsPath(uri);
            const vueFile = vueFiles.get(fileName);

            if (vueFile) {
                return vueDocuments.get(vueFile);
            }
        }),
        fromEmbeddedDocument: untrack((document: TextDocument) => {
            return embeddedDocumentsMap.value.get(document);
        }),
        sourceMapFromEmbeddedDocumentUri: untrack((lsType: 'script' | 'template' | 'nonTs', uri: string) => {
            return embeddedDocumentsMapLsType.value[lsType].get(uri);
        }),
        teleportfromEmbeddedDocumentUri: untrack((lsType: 'script' | 'template' | 'nonTs', uri: string) => {
            return teleportsMapLsType.value[lsType].get(uri);
        }),
        fromEmbeddedLocation: untrack(function* (
            lsType: 'script' | 'template' | 'nonTs',
            uri: string,
            start: vscode.Position,
            end?: vscode.Position,
            filter?: (data: EmbeddedFileMappingData) => boolean,
            sourceMapFilter?: (sourceMap: EmbeddedFileSourceMap) => boolean,
        ) {

            if (uri.endsWith(`/${localTypes.typesFileName}`))
                return;

            if (end === undefined)
                end = start;

            const sourceMap = embeddedDocumentsMapLsType.value[lsType].get(uri);

            if (sourceMap) {

                if (sourceMapFilter && !sourceMapFilter(sourceMap))
                    return;

                for (const vueRange of sourceMap.getSourceRanges(start, end, filter)) {
                    yield {
                        uri: sourceMap.sourceDocument.uri,
                        range: vueRange[0],
                        sourceMap,
                        data: vueRange[1],
                    };
                }
            }
            else {
                yield {
                    uri,
                    range: {
                        start,
                        end,
                    },
                };
            }
        }),
    };

    function getAll() {
        return vueFiles.getAll().map(vueFile => vueDocuments.get(vueFile));
    }
}

export function parseVueDocument(vueFile: VueFile) {

    // cache map
    let documentVersion = 0;
    const embeddedDocumentVersions = new Map<string, number>();
    const embeddedDocumentsMap = useCacheMap<EmbeddedFile, TextDocument>(embeddedFile => {

        const uri = shared.fsPathToUri(embeddedFile.fileName);
        const newVersion = (embeddedDocumentVersions.get(embeddedFile.lsType + ':' + uri.toLowerCase()) ?? 0) + 1;

        embeddedDocumentVersions.set(embeddedFile.lsType + ':' + uri.toLowerCase(), newVersion);

        return TextDocument.create(
            uri,
            shared.syntaxToLanguageId(embeddedFile.lang),
            newVersion,
            embeddedFile.content,
        );
    });
    const sourceMapsMap = useCacheMap<Embedded, EmbeddedDocumentSourceMap>(embedded => {
        return new EmbeddedDocumentSourceMap(
            embedded.file,
            document.value,
            embeddedDocumentsMap.get(embedded.file),
            embedded.sourceMap,
        );
    });

    // reactivity
    const document = computed(() => TextDocument.create(shared.fsPathToUri(vueFile.fileName), 'vue', documentVersion++, vueFile.refs.content.value));
    const sourceMaps = computed(() => {
        return vueFile.refs.allEmbeddeds.value.map(embedded => sourceMapsMap.get(embedded));
    });
    const teleports = computed(() => {
        return vueFile.refs.teleports.value.map(teleportAndFile => {
            const embeddedDocument = embeddedDocumentsMap.get(teleportAndFile.file);
            const sourceMap = new TeleportSourceMap(
                teleportAndFile.file,
                embeddedDocument,
                teleportAndFile.teleport,
            );
            return sourceMap;
        })
    });

    return {
        uri: shared.fsPathToUri(vueFile.fileName),
        file: vueFile,
        embeddedDocumentsMap,
        sourceMapsMap,
        getSourceMaps: untrack(() => sourceMaps.value),
        getDocument: untrack(() => document.value),

        refs: {
            sourceMaps,
            teleports,
        },
    };
}

export function useCacheMap<T extends object, K>(
    parse: (t: T) => K,
) {

    const cache = new WeakMap<T, K>();

    return {
        get,
    };

    function get(source: T) {

        let result = cache.get(source);

        if (!result) {

            result = parse(source);
            cache.set(source, result);
        }

        return result;
    }
}
