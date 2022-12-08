import { DocumentRegistry, EmbeddedFile, forEachEmbeddeds, PositionCapabilities, SourceFile, TeleportMappingData } from '@volar/language-core';
import * as shared from '@volar/shared';
import { Mapping, SourceMapBase } from '@volar/source-map';
import { computed } from '@vue/reactivity';
import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';

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

	// Range APIs

	public toSourceRange(range: vscode.Range, filter: (data: Data) => boolean = () => true) {
		for (const result of this.toSourceRanges(range, filter)) {
			return result;
		}
	}

	public toGeneratedRange(range: vscode.Range, filter: (data: Data) => boolean = () => true) {
		for (const result of this.toGeneratedRanges(range, filter)) {
			return result;
		}
	}

	public * toSourceRanges(range: vscode.Range, filter: (data: Data) => boolean = () => true) {
		for (const result of this.toRanges(range, filter, 'toSourcePositionsBase', 'matchSourcePosition')) {
			yield result;
		}
	}

	public * toGeneratedRanges(range: vscode.Range, filter: (data: Data) => boolean = () => true) {
		for (const result of this.toRanges(range, filter, 'toGeneratedPositionsBase', 'matchGeneratedPosition')) {
			yield result;
		}
	}

	protected * toRanges(
		range: vscode.Range,
		filter: (data: Data) => boolean,
		api: 'toSourcePositionsBase' | 'toGeneratedPositionsBase',
		api2: 'matchSourcePosition' | 'matchGeneratedPosition'
	) {
		const failedLookUps: (readonly [vscode.Position, Mapping<Data>])[] = [];
		for (const mapped of this[api](range.start, filter, 'left')) {
			const end = this[api2](range.end, mapped[1], 'right');
			if (end) {
				yield { start: mapped[0], end } as vscode.Range;
			}
			else {
				failedLookUps.push(mapped);
			}
		}
		for (const failedLookUp of failedLookUps) {
			for (const mapped of this[api](range.end, filter, 'right')) {
				yield { start: failedLookUp[0], end: mapped[0] } as vscode.Range;
			}
		}
	}

	// Position APIs

	public toSourcePosition(position: vscode.Position, filter: (data: Data) => boolean = () => true, baseOffset: 'left' | 'right' = 'left') {
		for (const mapped of this.toSourcePositions(position, filter, baseOffset)) {
			return mapped;
		}
	}

	public toGeneratedPosition(position: vscode.Position, filter: (data: Data) => boolean = () => true, baseOffset: 'left' | 'right' = 'left') {
		for (const mapped of this.toGeneratedPositions(position, filter, baseOffset)) {
			return mapped;
		}
	}

	public * toSourcePositions(position: vscode.Position, filter: (data: Data) => boolean = () => true, baseOffset: 'left' | 'right' = 'left') {
		for (const mapped of this.toSourcePositionsBase(position, filter, baseOffset)) {
			yield mapped[0];
		}
	}

	public * toGeneratedPositions(position: vscode.Position, filter: (data: Data) => boolean = () => true, baseOffset: 'left' | 'right' = 'left') {
		for (const mapped of this.toGeneratedPositionsBase(position, filter, baseOffset)) {
			yield mapped[0];
		}
	}

	public toSourcePositionsBase(position: vscode.Position, filter: (data: Data) => boolean = () => true, baseOffset: 'left' | 'right' = 'left') {
		return this.toPositions(position, filter, this.mappedDocument, this.sourceDocument, 'generatedRange', 'sourceRange', baseOffset);
	}

	public toGeneratedPositionsBase(position: vscode.Position, filter: (data: Data) => boolean = () => true, baseOffset: 'left' | 'right' = 'left') {
		return this.toPositions(position, filter, this.sourceDocument, this.mappedDocument, 'sourceRange', 'generatedRange', baseOffset);
	}

	protected * toPositions(
		position: vscode.Position,
		filter: (data: Data) => boolean,
		fromDoc: TextDocument,
		toDoc: TextDocument,
		from: 'sourceRange' | 'generatedRange',
		to: 'sourceRange' | 'generatedRange',
		baseOffset: 'left' | 'right',
	) {
		for (const mapped of this.matcing(fromDoc.offsetAt(position), from, to)) {
			if (!filter(mapped[1].data)) {
				continue;
			}
			let offset = mapped[0];
			const mapping = mapped[1];
			if (baseOffset === 'right') {
				offset += (mapping.sourceRange[1] - mapping.sourceRange[0]) - (mapping.generatedRange[1] - mapping.generatedRange[0]);
			}
			yield [toDoc.positionAt(offset), mapping] as const;
		}
	}

	protected matchSourcePosition(position: vscode.Position, mapping: Mapping, baseOffset: 'left' | 'right') {
		let offset = this.matchOffset(this.mappedDocument.offsetAt(position), mapping['generatedRange'], mapping['sourceRange']);
		if (offset !== undefined) {
			if (baseOffset === 'right') {
				offset += (mapping.sourceRange[1] - mapping.sourceRange[0]) - (mapping.generatedRange[1] - mapping.generatedRange[0]);
			}
			return this.sourceDocument.positionAt(offset);
		}
	}

	protected matchGeneratedPosition(position: vscode.Position, mapping: Mapping, baseOffset: 'left' | 'right') {
		let offset = this.matchOffset(this.sourceDocument.offsetAt(position), mapping['sourceRange'], mapping['generatedRange']);
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
		for (const mapped of this.toGeneratedPositionsBase(start)) {
			yield [mapped[0], mapped[1].data.toGenedCapabilities] as const;
		}
		for (const mapped of this.toSourcePositionsBase(start)) {
			yield [mapped[0], mapped[1].data.toSourceCapabilities] as const;
		}
	}
}

export function parseSourceFileDocuments(mapper: DocumentRegistry) {

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
	const embeddedDocumentMaps = computed(() => {
		const map = new Map<string, EmbeddedDocumentSourceMap>();
		for (const vueDocument of getAll()) {
			for (const sourceMap of vueDocument.getSourceMaps()) {
				map.set(sourceMap.mappedDocument.uri, sourceMap);
			}
		}
		return map;
	});
	const teleports = computed(() => {
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
			return embeddedDocumentMaps.value.get(uri);
		},
		teleportfromEmbeddedDocumentUri: (uri: string) => {
			return teleports.value.get(uri);
		},
	};

	function get(sourceFile: SourceFile) {
		let vueDocument = _sourceFiles.get(sourceFile);
		if (!vueDocument) {
			vueDocument = parseSourceFileDocument(sourceFile);
			_sourceFiles.set(sourceFile, vueDocument);
		}
		return vueDocument;
	}
	function getAll() {
		return mapper.getAll().map(file => get(file[0]));
	}
}

export function parseSourceFileDocument(sourceFile: SourceFile) {

	let documentVersion = 0;
	const embeddedDocumentVersions = new Map<string, number>();
	const embeddedDocuments = new WeakMap<SourceFile, TextDocument>();
	const sourceMaps = new WeakMap<SourceFile, [number, EmbeddedDocumentSourceMap]>();

	// computed
	const document = computed(() => TextDocument.create(
		shared.getUriByPath(sourceFile.fileName),
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
		uri: shared.getUriByPath(sourceFile.fileName),
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

			const uri = shared.getUriByPath(embeddedFile.fileName);
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
