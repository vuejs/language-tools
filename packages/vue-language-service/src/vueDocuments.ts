import * as vue from '@volar/vue-language-core';
import * as shared from '@volar/shared';
import { computed } from '@vue/reactivity';
import { SourceMapBase, Mapping } from '@volar/source-map';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { EmbeddedFileMappingData, TeleportMappingData, TeleportSideData } from '@volar/vue-language-core';
import { walkElementNodes } from '@volar/vue-language-core';
import * as CompilerDOM from '@vue/compiler-dom';
import * as vscode from 'vscode-languageserver-protocol';
import type * as ts2 from '@volar/typescript-language-service';

import type * as _ from '@volar/vue-language-core/node_modules/@vue/reactivity'; // fix build error

export type VueDocuments = ReturnType<typeof parseVueDocuments>;
export type VueDocument = ReturnType<typeof parseVueDocument>;

export interface ITemplateScriptData {
	components: string[];
	componentItems: vscode.CompletionItem[];
}

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

export class EmbeddedDocumentSourceMap extends SourceMap<EmbeddedFileMappingData> {

	constructor(
		public embeddedFile: vue.EmbeddedFile,
		public sourceDocument: TextDocument,
		public mappedDocument: TextDocument,
		_sourceMap: vue.EmbeddedFileSourceMap,
	) {
		super(sourceDocument, mappedDocument, _sourceMap.mappings);
	}
}

export class TeleportSourceMap extends SourceMap<TeleportMappingData> {
	constructor(
		public embeddedFile: vue.EmbeddedFile,
		public document: TextDocument,
		teleport: vue.Teleport,
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

export function parseVueDocuments(
	vueLsCtx: vue.LanguageContext,
	tsLs: ts2.LanguageService,
) {

	// cache map
	const vueDocuments = useCacheMap<vue.SourceFile, VueDocument>(vueFile => {
		return parseVueDocument(vueFile, tsLs);
	});

	// reactivity
	const embeddedDocumentsMap = computed(() => {
		const map = new Map<TextDocument, VueDocument>();
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

			const fileName = shared.uriToFsPath(uri);
			const vueFile = vueLsCtx.mapper.get(fileName);

			if (vueFile) {
				return vueDocuments.get(vueFile);
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
			filter?: (data: EmbeddedFileMappingData) => boolean,
			sourceMapFilter?: (sourceMap: vue.EmbeddedFileSourceMap) => boolean,
		) {

			if (uri.endsWith(`/${vue.localTypes.typesFileName}`))
				return;

			if (end === undefined)
				end = start;

			const sourceMap = embeddedDocumentsMapLsType.value.get(uri);

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
		},
	};

	function getAll() {
		return vueLsCtx.mapper.getAll().map(vueFile => vueDocuments.get(vueFile));
	}
}

export function parseVueDocument(
	vueFile: vue.SourceFile,
	tsLs: ts2.LanguageService | undefined,
) {

	// cache map
	let documentVersion = 0;
	const embeddedDocumentVersions = new Map<string, number>();
	const embeddedDocumentsMap = useCacheMap<vue.EmbeddedFile, TextDocument>(embeddedFile => {

		const uri = shared.fsPathToUri(embeddedFile.fileName);
		const newVersion = (embeddedDocumentVersions.get(uri.toLowerCase()) ?? 0) + 1;

		embeddedDocumentVersions.set(uri.toLowerCase(), newVersion);

		return TextDocument.create(
			uri,
			shared.syntaxToLanguageId(embeddedFile.fileName.split('.').pop()!),
			newVersion,
			embeddedFile.codeGen.getText(),
		);
	});
	const sourceMapsMap = useCacheMap<vue.Embedded, EmbeddedDocumentSourceMap>(embedded => {
		return new EmbeddedDocumentSourceMap(
			embedded.file,
			document.value,
			embeddedDocumentsMap.get(embedded.file),
			embedded.sourceMap,
		);
	});
	let templateScriptData: ITemplateScriptData = {
		components: [],
		componentItems: [],
	};

	// reactivity
	const document = computed(() => TextDocument.create(shared.fsPathToUri(vueFile.fileName), vueFile.fileName.endsWith('.md') ? 'markdown' : 'vue', documentVersion++, vueFile.text));
	const sourceMaps = computed(() => {
		return vueFile.allEmbeddeds.map(embedded => sourceMapsMap.get(embedded));
	});
	const teleports = computed(() => {
		return vueFile.teleports.map(teleportAndFile => {
			const embeddedDocument = embeddedDocumentsMap.get(teleportAndFile.file);
			const sourceMap = new TeleportSourceMap(
				teleportAndFile.file,
				embeddedDocument,
				teleportAndFile.teleport,
			);
			return sourceMap;
		});
	});
	const templateTagsAndAttrs = computed(() => {
		const ast = vueFile.compiledSFCTemplate?.ast;
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

	return {
		uri: shared.fsPathToUri(vueFile.fileName),
		file: vueFile,
		embeddedDocumentsMap,
		sourceMapsMap,
		getTemplateData: getTemplateData,
		getSourceMaps: () => sourceMaps.value,
		getTeleports: () => teleports.value,
		getDocument: () => document.value,
		getTemplateTagsAndAttrs: () => templateTagsAndAttrs.value,
	};


	async function getTemplateData() {

		const options: ts.GetCompletionsAtPositionOptions = {
			includeCompletionsWithInsertText: true, // if missing, { 'aaa-bbb': any, ccc: any } type only has result ['ccc']
		};

		const file = vueFile.allEmbeddeds.find(e => e.file.fileName.indexOf('.__VLS_template.') >= 0)?.file;
		if (file && file.codeGen.getText().indexOf(vue.SearchTexts.Components) >= 0) {
			const document = embeddedDocumentsMap.get(file);

			let components = await tsLs?.doComplete(
				shared.fsPathToUri(file!.fileName),
				document.positionAt(file!.codeGen.getText().indexOf(vue.SearchTexts.Components)),
				options
			);

			if (components) {

				const items = components.items
					.filter(entry => entry.kind !== vscode.CompletionItemKind.Text)
					.filter(entry => entry.label.indexOf('$') === -1 && !entry.label.startsWith('_'));

				const componentNames = items.map(entry => entry.label);

				templateScriptData = {
					components: componentNames,
					componentItems: items,
				};
			}
		}

		return templateScriptData;
	}
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
