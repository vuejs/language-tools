import { VueDocument } from '@volar/vue-typescript';
import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { definePlugin } from './definePlugin';

export interface ReferencesCodeLensData {
    uri: string,

    position: vscode.Position,
}

export default definePlugin((host: {
    getVueDocument(uri: string): VueDocument | undefined,
    findReference(uri: string, position: vscode.Position): Promise<vscode.Location[] | undefined>,
    clientShowReferenceCommand?: string,
}) => {

    return {

        doCodeLens(document) {
            return worker(document.uri, (vueDocument) => {

                const result: vscode.CodeLens[] = [];

                for (const sourceMap of vueDocument.getSourceMaps()) {
                    for (const mapping of sourceMap.mappings) {

                        if (!mapping.data.capabilities.referencesCodeLens)
                            continue;

                        const data: ReferencesCodeLensData = {
                            uri: document.uri,
                            position: document.positionAt(mapping.sourceRange.start),
                        };

                        result.push({
                            range: {
                                start: document.positionAt(mapping.sourceRange.start),
                                end: document.positionAt(mapping.sourceRange.end),
                            },
                            data: data as any,
                        });
                    }
                }

                return result;
            });
        },

        async doCodeLensResolve(codeLens) {

            const data: ReferencesCodeLensData = codeLens.data as any;
            const vueDocument = host.getVueDocument(data.uri)

            if (!vueDocument)
                return codeLens;

            const sourceMap = vueDocument.getSourceMaps().find(sourceMap => !!sourceMap.getMappedRange(data.position));

            if (!sourceMap)
                return codeLens;

            const references = await host.findReference(data.uri, data.position) ?? [];
            const referencesInDifferentDocument = references.filter(reference =>
                reference.uri !== data.uri // different file
                || !sourceMap.getMappedRange(reference.range.start, reference.range.end) // different embedded document
            );
            const referencesCount = referencesInDifferentDocument.length ?? 0;

            codeLens.command = {
                title: referencesCount === 1 ? '1 reference' : `${referencesCount} references`,
                command: host.clientShowReferenceCommand ?? '',
                arguments: [data.uri, codeLens.range.start, references],
            };

            return codeLens;
        },
    };

    function worker<T>(uri: string, callback: (vueDocument: VueDocument) => T) {

        const vueDocument = host.getVueDocument(uri);
        if (!vueDocument)
            return;

        return callback(vueDocument);
    }
});
