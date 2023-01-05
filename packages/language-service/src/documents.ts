import { VirtualFiles, VirtualFile, FileRangeCapabilities, MirrorBehaviorCapabilities, MirrorMap, forEachEmbeddedFile } from '@volar/language-core';
import * as shared from '@volar/shared';
import { Mapping, SourceMap } from '@volar/source-map';
import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type * as ts from 'typescript/lib/tsserverlibrary';

export type DocumentsAndSourceMaps = ReturnType<typeof createDocumentsAndSourceMaps>;

export class SourceMapWithDocuments<Data = any> {

	constructor(
		public sourceFileDocument: TextDocument,
		public virtualFileDocument: TextDocument,
		public map: SourceMap<Data>,
	) { }

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
		return this.toPositions(position, filter, this.virtualFileDocument, this.sourceFileDocument, 'generatedRange', 'sourceRange', baseOffset);
	}

	public toGeneratedPositionsBase(position: vscode.Position, filter: (data: Data) => boolean = () => true, baseOffset: 'left' | 'right' = 'left') {
		return this.toPositions(position, filter, this.sourceFileDocument, this.virtualFileDocument, 'sourceRange', 'generatedRange', baseOffset);
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
		for (const mapped of this.map.matching(fromDoc.offsetAt(position), from, to, baseOffset === 'right')) {
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
		let offset = this.map.matchOffset(this.virtualFileDocument.offsetAt(position), mapping['generatedRange'], mapping['sourceRange'], baseOffset === 'right');
		if (offset !== undefined) {
			return this.sourceFileDocument.positionAt(offset);
		}
	}

	protected matchGeneratedPosition(position: vscode.Position, mapping: Mapping, baseOffset: 'left' | 'right') {
		let offset = this.map.matchOffset(this.sourceFileDocument.offsetAt(position), mapping['sourceRange'], mapping['generatedRange'], baseOffset === 'right');
		if (offset !== undefined) {
			return this.virtualFileDocument.positionAt(offset);
		}
	}
}

export class MirrorMapWithDocument extends SourceMapWithDocuments<[MirrorBehaviorCapabilities, MirrorBehaviorCapabilities]> {
	constructor(
		public document: TextDocument,
		map: MirrorMap,
	) {
		super(document, document, map);
	}
	*findMirrorPositions(start: vscode.Position) {
		for (const mapped of this.toGeneratedPositionsBase(start)) {
			yield [mapped[0], mapped[1].data[1]] as const;
		}
		for (const mapped of this.toSourcePositionsBase(start)) {
			yield [mapped[0], mapped[1].data[0]] as const;
		}
	}
}

export function createDocumentsAndSourceMaps(mapper: VirtualFiles) {

	let version = 0;

	const _maps = new WeakMap<SourceMap<FileRangeCapabilities>, [VirtualFile, SourceMapWithDocuments<FileRangeCapabilities>]>();
	const _mirrorMaps = new WeakMap<MirrorMap, [VirtualFile, MirrorMapWithDocument]>();
	const _documents = new WeakMap<ts.IScriptSnapshot, Map<string, TextDocument>>();

	return {
		getSourceByUri(sourceFileUri: string) {
			const fileName = shared.getPathOfUri(sourceFileUri);
			return mapper.get(fileName);
		},
		getRootFileBySourceFileUri(sourceFileUri: string) {
			const fileName = shared.getPathOfUri(sourceFileUri);
			const rootFile = mapper.get(fileName);
			if (rootFile) {
				return rootFile[1];
			}
		},
		getVirtualFileByUri(virtualFileUri: string) {
			return mapper.getSourceByVirtualFileName(shared.getPathOfUri(virtualFileUri))?.[2];
		},
		getMirrorMapByUri(virtualFileUri: string) {
			const fileName = shared.getPathOfUri(virtualFileUri);
			const virtualFile = mapper.getSourceByVirtualFileName(fileName)?.[2];
			if (virtualFile) {
				const map = mapper.getMirrorMap(virtualFile);
				if (map) {
					if (!_mirrorMaps.has(map)) {
						_mirrorMaps.set(map, [virtualFile, new MirrorMapWithDocument(
							getDocumentByFileName(virtualFile.snapshot, fileName),
							map,
						)]);
					}
					return _mirrorMaps.get(map);
				}
			}
		},
		getMapsBySourceFileUri(uri: string) {
			return this.getMapsBySourceFileName(shared.getPathOfUri(uri));
		},
		getMapsBySourceFileName(fileName: string) {
			const source = mapper.get(fileName);
			if (source) {
				const result: [VirtualFile, SourceMapWithDocuments<FileRangeCapabilities>][] = [];
				forEachEmbeddedFile(source[1], (embedded) => {
					for (const [sourceFileName, map] of mapper.getMaps(embedded)) {
						if (sourceFileName === fileName) {
							if (!_maps.has(map)) {
								_maps.set(map, [
									embedded,
									new SourceMapWithDocuments(
										getDocumentByFileName(source[0], sourceFileName),
										getDocumentByFileName(embedded.snapshot, fileName),
										map,
									)
								]);
							}
							if (_maps.has(map)) {
								result.push(_maps.get(map)!);
							}
						}
					}
				});
				return {
					snapshot: source[0],
					maps: result,
				};
			}
		},
		getMapsByVirtualFileUri(virtualFileUri: string) {
			return this.getMapsByVirtualFileName(shared.getPathOfUri(virtualFileUri));
		},
		*getMapsByVirtualFileName(virtualFileName: string): IterableIterator<[VirtualFile, SourceMapWithDocuments<FileRangeCapabilities>]> {
			const virtualFile = mapper.getSourceByVirtualFileName(virtualFileName)?.[2];
			if (virtualFile) {
				for (const [sourceFileName, map] of mapper.getMaps(virtualFile)) {
					if (!_maps.has(map)) {
						const sourceSnapshot = mapper.get(sourceFileName)?.[0];
						if (sourceSnapshot) {
							_maps.set(map, [virtualFile, new SourceMapWithDocuments(
								getDocumentByFileName(sourceSnapshot, sourceFileName),
								getDocumentByFileName(virtualFile.snapshot, virtualFileName),
								map,
							)]);
						}
					}
					if (_maps.has(map)) {
						yield _maps.get(map)!;
					}
				}
			}
		},
		getDocumentByUri(snapshot: ts.IScriptSnapshot, uri: string) {
			return this.getDocumentByFileName(snapshot, shared.getPathOfUri(uri));
		},
		getDocumentByFileName,
	};

	function getDocumentByFileName(snapshot: ts.IScriptSnapshot, fileName: string) {
		if (!_documents.has(snapshot)) {
			_documents.set(snapshot, new Map());
		}
		const map = _documents.get(snapshot)!;
		if (!map.has(fileName)) {
			map.set(fileName, TextDocument.create(
				shared.getUriByPath(fileName),
				shared.syntaxToLanguageId(fileName.substring(fileName.lastIndexOf('.') + 1)),
				version++,
				snapshot.getText(0, snapshot.getLength()),
			));
		}
		return map.get(fileName)!;
	}
}
