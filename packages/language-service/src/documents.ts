import { DocumentRegistry, EmbeddedFile, forEachEmbeddeds, PositionCapabilities, SourceFile, TeleportMappingData } from '@volar/language-core';
import * as shared from '@volar/shared';
import { Mapping, SourceMapBase } from '@volar/source-map';
import { computed } from '@vue/reactivity';
import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { URI } from 'vscode-uri';

export type SourceFileDocuments = ReturnType<typeof parseSourceFileDocuments>;
export type SourceFileDocument = ReturnType<typeof parseSourceFileDocument>;

export class SourceMap<Data = undefined> extends SourceMapBase<Data> {

	constructor(
		public sourceDocument: TextDocument,
		public mappedDocument: TextDocument,
		public mappings: Mapping<Data>[],
	) {
		super(mappings);
	}

	public toSourcePosition(start: vscode.Position, baseOffset: 'left' | 'right' = 'left') {
		for (const mapped of this.getPositions(start, this.mappedDocument, this.sourceDocument, 'generatedRange', 'sourceRange', baseOffset)) {
			return mapped;
		}
	}

	public toGeneratedPosition(start: vscode.Position, baseOffset: 'left' | 'right' = 'left') {
		for (const mapped of this.getPositions(start, this.sourceDocument, this.mappedDocument, 'sourceRange', 'generatedRange', baseOffset)) {
			return mapped;
		}
	}

	public toSourcePositions(start: vscode.Position, baseOffset: 'left' | 'right' = 'left') {
		return this.getPositions(start, this.mappedDocument, this.sourceDocument, 'generatedRange', 'sourceRange', baseOffset);
	}

	public toGeneratedPositions(start: vscode.Position, baseOffset: 'left' | 'right' = 'left') {
		return this.getPositions(start, this.sourceDocument, this.mappedDocument, 'sourceRange', 'generatedRange', baseOffset);
	}

	protected * getPositions(start: vscode.Position, fromDoc: TextDocument, toDoc: TextDocument, from: 'sourceRange' | 'generatedRange', to: 'sourceRange' | 'generatedRange', baseOffset: 'left' | 'right') {
		for (const mapped of this.matcing(fromDoc.offsetAt(start), from, to)) {
			let offset = mapped[0];
			const mapping = mapped[1];
			if (baseOffset === 'right') {
				offset += (mapping.sourceRange[1] - mapping.sourceRange[0]) - (mapping.generatedRange[1] - mapping.generatedRange[0]);
			}
			yield [toDoc.positionAt(offset), mapping] as const;
		}
	}

	public matchSourcePosition(start: vscode.Position, mapping: Mapping, baseOffset: 'left' | 'right') {
		let offset = this.matchOffset(this.mappedDocument.offsetAt(start), mapping['generatedRange'], mapping['sourceRange']);
		if (offset !== undefined) {
			if (baseOffset === 'right') {
				offset += (mapping.sourceRange[1] - mapping.sourceRange[0]) - (mapping.generatedRange[1] - mapping.generatedRange[0]);
			}
			return this.sourceDocument.positionAt(offset);
		}
	}

	public matchGeneratedPosition(start: vscode.Position, mapping: Mapping, baseOffset: 'left' | 'right') {
		let offset = this.matchOffset(this.sourceDocument.offsetAt(start), mapping['sourceRange'], mapping['generatedRange']);
		if (offset !== undefined) {
			if (baseOffset === 'right') {
				offset += (mapping.generatedRange[1] - mapping.generatedRange[0]) - (mapping.sourceRange[1] - mapping.sourceRange[0]);
			}
			return this.mappedDocument.positionAt(offset);
		}
	}
}

export class EmbeddedDocumentSourceMap extends SourceMap<PositionCapabilities> {

	constructor(
		public embeddedFile: EmbeddedFile,
		public sourceDocument: TextDocument,
		public mappedDocument: TextDocument,
		mappings: Mapping<PositionCapabilities>[],
	) {
		super(sourceDocument, mappedDocument, mappings);
	}
}

export class TeleportSourceMap extends SourceMap<TeleportMappingData> {
	constructor(
		public embeddedFile: EmbeddedFile,
		public document: TextDocument,
		mappings: Mapping<TeleportMappingData>[],
	) {
		super(document, document, mappings);
	}
	*findTeleports(start: vscode.Position) {
		for (const mapped of this.toGeneratedPositions(start)) {
			yield [mapped[0], mapped[1].data.toGenedCapabilities] as const;
		}
		for (const mapped of this.toSourcePositions(start)) {
			yield [mapped[0], mapped[1].data.toSourceCapabilities] as const;
		}
	}
}

export function parseSourceFileDocuments(
	rootUri: URI,
	mapper: DocumentRegistry,
) {

	const _sourceFiles = new WeakMap<SourceFile, SourceFileDocument>();

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
		) {

			if (uri.endsWith('/__VLS_types.ts')) { // TODO: remove this monkey fix
				return;
			}

			const sourceMap = embeddedDocumentsMapLsType.value.get(uri);
			if (sourceMap) {

				for (const vueRange of sourceMap.toSourcePositions(start)) {
					yield {
						uri: sourceMap.sourceDocument.uri,
						position: vueRange[0],
						sourceMap,
						mapping: vueRange[1],
					};
				}
			}
			else {
				yield {
					uri,
					position: start,
				};
			}
		},
	};

	function get(sourceFile: SourceFile) {
		let vueDocument = _sourceFiles.get(sourceFile);
		if (!vueDocument) {
			vueDocument = parseSourceFileDocument(rootUri, sourceFile);
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
	sourceFile: SourceFile,
) {

	let documentVersion = 0;
	const embeddedDocumentVersions = new Map<string, number>();
	const embeddedDocuments = new WeakMap<SourceFile, TextDocument>();
	const sourceMaps = new WeakMap<SourceFile, [number, EmbeddedDocumentSourceMap]>();

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
					embedded.teleportMappings,
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

	function getSourceMap(embedded: EmbeddedFile) {

		let cache = sourceMaps.get(embedded);

		if (!cache || cache[0] !== document.value.version) {

			cache = [
				document.value.version,
				new EmbeddedDocumentSourceMap(
					embedded,
					document.value,
					getEmbeddedDocument(embedded),
					embedded.mappings,
				)
			];
			sourceMaps.set(embedded, cache);
		}

		return cache[1];
	}

	function getEmbeddedDocument(embeddedFile: SourceFile) {

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
