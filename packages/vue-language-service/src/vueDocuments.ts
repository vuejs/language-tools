import * as vue from '@volar/vue-language-core';
import * as shared from '@volar/shared';
import { computed, ComputedRef } from '@vue/reactivity';
import { SourceMapBase } from '@volar/source-map';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { EmbeddedLangaugeSourceFile, walkElementNodes } from '@volar/vue-language-core';
import * as CompilerDOM from '@vue/compiler-dom';
import * as vscode from 'vscode-languageserver-protocol';

import { URI } from 'vscode-uri';

import type * as ts from 'typescript/lib/tsserverlibrary';

export type SourceFileDocuments = ReturnType<typeof parseSourceFileDocuments>;
export type SourceFileDocument = ReturnType<typeof parseSourceFileDocument>;

export interface ITemplateScriptData {
	components: string[];
	componentItems: vscode.CompletionItem[];
}

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

export class EmbeddedDocumentSourceMap extends SourceMap<vue.EmbeddedFileMappingData> {

	constructor(
		public embeddedFile: vue.EmbeddedFile,
		public sourceDocument: TextDocument,
		public mappedDocument: TextDocument,
		_sourceMap: vue.EmbeddedFileSourceMap,
	) {
		super(sourceDocument, mappedDocument, _sourceMap);
	}
}

export class TeleportSourceMap extends SourceMap<vue.TeleportMappingData> {
	constructor(
		public embeddedFile: vue.EmbeddedFile,
		public document: TextDocument,
		teleport: vue.Teleport,
	) {
		super(document, document, teleport);
	}
	*findTeleports(start: vscode.Position, end?: vscode.Position, filter?: (data: vue.TeleportSideData) => boolean) {
		for (const [teleRange, data] of this.getMappedRanges(start, end, filter ? data => filter(data.toTarget) : undefined)) {
			yield [teleRange, data.toTarget] as const;
		}
		for (const [teleRange, data] of this.getSourceRanges(start, end, filter ? data => filter(data.toSource) : undefined)) {
			yield [teleRange, data.toSource] as const;
		}
	}
}

export function parseSourceFileDocuments(
	rootUri: URI,
	vueLsCtx: vue.VueLanguageContext,
) {

	const _sourceFiles = new WeakMap<EmbeddedLangaugeSourceFile, SourceFileDocument>();

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
			const vueFile = vueLsCtx.mapper.get(fileName);

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
			filter?: (data: vue.EmbeddedFileMappingData) => boolean,
			sourceMapFilter?: (sourceMap: vue.EmbeddedFileSourceMap) => boolean,
		) {

			if (uri.endsWith(`/${vue.localTypes.typesFileName}`))
				return;

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

	function get(sourceFile: EmbeddedLangaugeSourceFile) {
		let vueDocument = _sourceFiles.get(sourceFile);
		if (!vueDocument) {
			vueDocument = parseSourceFileDocument(rootUri, sourceFile);
			_sourceFiles.set(sourceFile, vueDocument);
		}
		return vueDocument;
	}
	function getAll() {
		return vueLsCtx.mapper.getAll().map(file => get(file[0]));
	}
}

export function parseSourceFileDocument(
	rootUri: URI,
	sourceFile: EmbeddedLangaugeSourceFile,
) {

	let documentVersion = 0;
	const embeddedDocumentVersions = new Map<string, number>();
	const embeddedDocuments = new WeakMap<vue.EmbeddedFile, TextDocument>();
	const sourceMaps = new WeakMap<vue.Embedded, [number, EmbeddedDocumentSourceMap]>();

	// computed
	const document = computed(() => TextDocument.create(
		shared.getUriByPath(rootUri, sourceFile.fileName),
		sourceFile.fileName.endsWith('.md') ? 'markdown' : 'vue',
		documentVersion++,
		sourceFile.text,
	));
	const allSourceMaps = computed(() => {
		const result: EmbeddedDocumentSourceMap[] = [];
		vue.forEachEmbeddeds(sourceFile.embeddeds, embedded => {
			result.push(getSourceMap(embedded));
		});
		return result;
	});
	const teleports = computed(() => {
		const result: TeleportSourceMap[] = [];
		vue.forEachEmbeddeds(sourceFile.embeddeds, embedded => {
			if (embedded.teleport) {
				const embeddedDocument = getEmbeddedDocument(embedded.file)!;
				const sourceMap = new TeleportSourceMap(
					embedded.file,
					embeddedDocument,
					embedded.teleport,
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

	function getSourceMap(embedded: vue.Embedded) {

		let cache = sourceMaps.get(embedded);

		if (!cache || cache[0] !== document.value.version) {

			cache = [
				document.value.version,
				new EmbeddedDocumentSourceMap(
					embedded.file,
					document.value,
					getEmbeddedDocument(embedded.file),
					embedded.sourceMap,
				)
			];
			sourceMaps.set(embedded, cache);
		}

		return cache[1];
	}

	function getEmbeddedDocument(embeddedFile: vue.EmbeddedFile) {

		let document = embeddedDocuments.get(embeddedFile);

		if (!document) {

			const uri = shared.getUriByPath(rootUri, embeddedFile.fileName);
			const newVersion = (embeddedDocumentVersions.get(uri.toLowerCase()) ?? 0) + 1;

			embeddedDocumentVersions.set(uri.toLowerCase(), newVersion);

			document = TextDocument.create(
				uri,
				shared.syntaxToLanguageId(embeddedFile.fileName.split('.').pop()!),
				newVersion,
				embeddedFile.codeGen.getText(),
			);
			embeddedDocuments.set(embeddedFile, document);
		}

		return document;
	}
}

export function checkTemplateData(
	sourceFile: EmbeddedLangaugeSourceFile,
	tsLs: ts.LanguageService,
) {

	if (!(sourceFile instanceof vue.VueSourceFile)) {
		return {
			components: [],
			componentItems: [],
		};
	}

	const options: ts.GetCompletionsAtPositionOptions = {
		includeCompletionsWithInsertText: true, // if missing, { 'aaa-bbb': any, ccc: any } type only has result ['ccc']
	};

	let file: vue.EmbeddedFile | undefined;
	vue.forEachEmbeddeds(sourceFile.embeddeds, embedded => {
		if (embedded.file.fileName === sourceFile.tsFileName) {
			file = embedded.file;
		}
	});

	if (file && file.codeGen.getText().indexOf(vue.SearchTexts.Components) >= 0) {

		const components = tsLs.getCompletionsAtPosition(
			file.fileName,
			file.codeGen.getText().indexOf(vue.SearchTexts.Components),
			options
		);

		if (components) {

			const items = components.entries
				.filter(entry => entry.kind !== 'warning')
				.filter(entry => entry.name.indexOf('$') === -1 && !entry.name.startsWith('_'));

			const componentNames = items.map(entry => entry.name);

			return {
				components: componentNames,
				componentItems: items,
			};
		}
	}

	return {
		components: [],
		componentItems: [],
	};
}

const map = new WeakMap<EmbeddedLangaugeSourceFile, ComputedRef>();

export function getTemplateTagsAndAttrs(sourceFile: EmbeddedLangaugeSourceFile) {

	if (!map.has(sourceFile)) {
		const getter = computed(() => {
			if (!(sourceFile instanceof vue.VueSourceFile))
				return;
			const ast = sourceFile.compiledSFCTemplate?.ast;
			const tags = new Map<string, number[]>();
			const attrs = new Set<string>();
			if (ast) {
				walkElementNodes(ast, node => {

					if (!tags.has(node.tag)) {
						tags.set(node.tag, []);
					}

					const offsets = tags.get(node.tag)!;
					const startTagHtmlOffset = node.loc.start.offset + node.loc.source.indexOf(node.tag);
					const endTagHtmlOffset = node.loc.start.offset + node.loc.source.lastIndexOf(node.tag);

					offsets.push(startTagHtmlOffset);
					offsets.push(endTagHtmlOffset);

					for (const prop of node.props) {
						if (
							prop.type === CompilerDOM.NodeTypes.DIRECTIVE
							&& prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
							&& prop.arg.isStatic
						) {
							attrs.add(prop.arg.content);
						}
						else if (
							prop.type === CompilerDOM.NodeTypes.ATTRIBUTE
						) {
							attrs.add(prop.name);
						}
					}
				});
			}
			return {
				tags,
				attrs,
			};
		});
		map.set(sourceFile, getter);
	}

	return map.get(sourceFile)!.value;
}
