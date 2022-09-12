import { DocumentRegistry, EmbeddedFileSourceMap, FileNode, forEachEmbeddeds, PositionCapabilities, Teleport, TeleportMappingData, TeleportCapabilities } from '@volar/language-core';
import * as shared from '@volar/shared';
import { SourceMapBase } from '@volar/source-map';
import { computed } from '@vue/reactivity';
import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { URI } from 'vscode-uri';

export type SourceFileDocuments = ReturnType<typeof parseSourceFileDocuments>;
export type SourceFileDocument = ReturnType<typeof parseSourceFileDocument>;

export class SourceMap<Data = undefined> {

	constructor(
		public sourceDocument: TextDocument,
		public mappedDocument: TextDocument,
		public base: SourceMapBase<Data> = new SourceMapBase(),
	) {
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

		for (const mapped of this.base.getRanges(startOffset, endOffset, sourceToTarget, filter)) {
			yield getMapped(mapped);
		}

		function getMapped(mapped: [{ start: number, end: number; }, Data]): [{ start: T, end: T; }, Data] {
			if (startIsNumber) {
				return mapped as [{ start: T, end: T; }, Data];
			}
			return [{
				start: toDoc.positionAt(mapped[0].start) as T,
				end: toDoc.positionAt(mapped[0].end) as T,
			}, mapped[1]];
		}
	}
}

export class EmbeddedDocumentSourceMap extends SourceMap<PositionCapabilities> {

	constructor(
		public embeddedFile: FileNode,
		public sourceDocument: TextDocument,
		public mappedDocument: TextDocument,
		_sourceMap: EmbeddedFileSourceMap,
	) {
		super(sourceDocument, mappedDocument, _sourceMap);
	}
}

export class TeleportSourceMap extends SourceMap<TeleportMappingData> {
	constructor(
		public embeddedFile: FileNode,
		public document: TextDocument,
		teleport: Teleport,
	) {
		super(document, document, teleport);
	}
	*findTeleports(start: vscode.Position, end?: vscode.Position, filter?: (data: TeleportCapabilities) => boolean) {
		for (const [teleRange, data] of this.getMappedRanges(start, end, filter ? data => filter(data.toGenedCapabilities) : undefined)) {
			yield [teleRange, data.toGenedCapabilities] as const;
		}
		for (const [teleRange, data] of this.getSourceRanges(start, end, filter ? data => filter(data.toSourceCapabilities) : undefined)) {
			yield [teleRange, data.toSourceCapabilities] as const;
		}
	}
}

export function parseSourceFileDocuments(
	rootUri: URI,
	mapper: DocumentRegistry,
) {

	const _sourceFiles = new WeakMap<FileNode, SourceFileDocument>();

	// reactivity
	const embeddedDocumentsMap = computed(() => {
		const map = new Map<TextDocument, SourceFileDocument>();
		for (const vueDocument of getAll()) {
			for (const sourceMap of vueDocument.getSourceMaps()) {
				map.set(sourceMap.mappedDocument, vueDocument);
			}
		}
		return map;
	});
	const embeddedDocumentsMapLsType = computed(() => {
		const map = new Map<string, EmbeddedDocumentSourceMap>();
		for (const vueDocument of getAll()) {
			for (const sourceMap of vueDocument.getSourceMaps()) {
				map.set(sourceMap.mappedDocument.uri, sourceMap);
			}
		}
		return map;
	});
	const teleportsMapLsType = computed(() => {
		const map = new Map<string, TeleportSourceMap>();
		for (const vueDocument of getAll()) {
			for (const teleport of vueDocument.getTeleports()) {
				map.set(teleport.mappedDocument.uri, teleport);
			}
		}
		return map;
	});

	return {
		getAll: getAll,
		get: (uri: string) => {

			const fileName = shared.getPathOfUri(uri);
			const vueFile = mapper.get(fileName);

			if (vueFile) {
				return get(vueFile[0]);
			}
		},
		fromEmbeddedDocument: (document: TextDocument) => {
			return embeddedDocumentsMap.value.get(document);
		},
		sourceMapFromEmbeddedDocumentUri: (uri: string) => {
			return embeddedDocumentsMapLsType.value.get(uri);
		},
		teleportfromEmbeddedDocumentUri: (uri: string) => {
			return teleportsMapLsType.value.get(uri);
		},
		fromEmbeddedLocation: function* (
			uri: string,
			start: vscode.Position,
			end?: vscode.Position,
			filter?: (data: PositionCapabilities) => boolean,
			sourceMapFilter?: (sourceMap: EmbeddedFileSourceMap) => boolean,
		) {

			if (uri.endsWith('/__VLS_types.ts')) { // TODO: monkey fix
				return;
			}

			if (end === undefined)
				end = start;

			const sourceMap = embeddedDocumentsMapLsType.value.get(uri);

			if (sourceMap) {

				if (sourceMapFilter && !sourceMapFilter(sourceMap.base))
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
		},
	};

	function get(sourceFile: FileNode) {
		let vueDocument = _sourceFiles.get(sourceFile);
		if (!vueDocument) {
			vueDocument = parseSourceFileDocument(rootUri, sourceFile, mapper);
			_sourceFiles.set(sourceFile, vueDocument);
		}
		return vueDocument;
	}
	function getAll() {
		return mapper.getAll().map(file => get(file[0]));
	}
}

export function parseSourceFileDocument(
	rootUri: URI,
	sourceFile: FileNode,
	mapper: DocumentRegistry,
) {

	let documentVersion = 0;
	const embeddedDocumentVersions = new Map<string, number>();
	const embeddedDocuments = new WeakMap<FileNode, TextDocument>();
	const sourceMaps = new WeakMap<FileNode, [number, EmbeddedDocumentSourceMap]>();

	// computed
	const document = computed(() => TextDocument.create(
		shared.getUriByPath(rootUri, sourceFile.fileName),
		sourceFile.fileName.endsWith('.md') ? 'markdown' : 'vue',
		documentVersion++,
		sourceFile.text,
	));
	const allSourceMaps = computed(() => {
		const result: EmbeddedDocumentSourceMap[] = [];
		forEachEmbeddeds(sourceFile.embeddeds, embedded => {
			result.push(getSourceMap(embedded));
		});
		return result;
	});
	const teleports = computed(() => {
		const result: TeleportSourceMap[] = [];
		forEachEmbeddeds(sourceFile.embeddeds, embedded => {
			if (embedded.teleportMappings) {
				const embeddedDocument = getEmbeddedDocument(embedded)!;
				const sourceMap = new TeleportSourceMap(
					embedded,
					embeddedDocument,
					mapper.getTeleportSourceMap(sourceFile, embedded.teleportMappings),
				);
				result.push(sourceMap);
			}
		});
		return result;
	});

	return {
		uri: shared.getUriByPath(rootUri, sourceFile.fileName),
		file: sourceFile,
		getSourceMap,
		getEmbeddedDocument,
		getSourceMaps: () => allSourceMaps.value,
		getTeleports: () => teleports.value,
		getDocument: () => document.value,
	};

	function getSourceMap(embedded: FileNode) {

		let cache = sourceMaps.get(embedded);

		if (!cache || cache[0] !== document.value.version) {

			cache = [
				document.value.version,
				new EmbeddedDocumentSourceMap(
					embedded,
					document.value,
					getEmbeddedDocument(embedded),
					mapper.getSourceMap(sourceFile, embedded.mappings),
				)
			];
			sourceMaps.set(embedded, cache);
		}

		return cache[1];
	}

	function getEmbeddedDocument(embeddedFile: FileNode) {

		let document = embeddedDocuments.get(embeddedFile);

		if (!document || document.getText() !== embeddedFile.text) {

			const uri = shared.getUriByPath(rootUri, embeddedFile.fileName);
			const newVersion = (embeddedDocumentVersions.get(uri.toLowerCase()) ?? 0) + 1;

			embeddedDocumentVersions.set(uri.toLowerCase(), newVersion);

			document = TextDocument.create(
				uri,
				shared.syntaxToLanguageId(embeddedFile.fileName.split('.').pop()!),
				newVersion,
				embeddedFile.text,
			);
			embeddedDocuments.set(embeddedFile, document);
		}

		return document;
	}
}
