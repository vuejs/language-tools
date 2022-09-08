import * as vue from '@volar/vue-language-core';
import * as shared from '@volar/shared';
import { computed } from '@vue/reactivity';
import { SourceMapBase } from '@volar/source-map';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { EmbeddedFileMappingData, TeleportMappingData, TeleportSideData } from '@volar/vue-language-core';
import { walkElementNodes } from '@volar/vue-language-core';
import * as CompilerDOM from '@vue/compiler-dom';
import * as vscode from 'vscode-languageserver-protocol';
import type * as ts2 from '@volar/typescript-language-service';

import { URI } from 'vscode-uri';

export type VueDocuments = ReturnType<typeof parseVueDocuments>;
export type VueDocument = ReturnType<typeof parseVueDocument>;

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

export class EmbeddedDocumentSourceMap extends SourceMap<EmbeddedFileMappingData> {

	constructor(
		public embeddedFile: vue.EmbeddedFile,
		public sourceDocument: TextDocument,
		public mappedDocument: TextDocument,
		_sourceMap: vue.EmbeddedFileSourceMap,
	) {
		super(sourceDocument, mappedDocument, _sourceMap);
	}
}

export class TeleportSourceMap extends SourceMap<TeleportMappingData> {
	constructor(
		public embeddedFile: vue.EmbeddedFile,
		public document: TextDocument,
		teleport: vue.Teleport,
	) {
		super(document, document, teleport);
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
	rootUri: URI,
	vueLsCtx: vue.LanguageContext,
	tsLs: ts2.LanguageService,
) {

	const _vueDocuments = new WeakMap<vue.SourceFile, VueDocument>();

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

			const fileName = shared.getPathOfUri(uri);
			const vueFile = vueLsCtx.mapper.get(fileName);

			if (vueFile) {
				return get(vueFile);
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

	function get(vueFile: vue.SourceFile) {
		let vueDocument = _vueDocuments.get(vueFile);
		if (!vueDocument) {
			vueDocument = parseVueDocument(rootUri, vueFile, tsLs);
			_vueDocuments.set(vueFile, vueDocument);
		}
		return vueDocument;
	}
	function getAll() {
		return vueLsCtx.mapper.getAll().map(get);
	}
}

export function parseVueDocument(
	rootUri: URI,
	vueFile: vue.SourceFile,
	tsLs: ts2.LanguageService | undefined,
) {

	let documentVersion = 0;
	let templateScriptData: ITemplateScriptData = {
		components: [],
		componentItems: [],
	};
	const embeddedDocumentVersions = new Map<string, number>();
	const embeddedDocuments = new WeakMap<vue.EmbeddedFile, TextDocument>();
	const sourceMaps = new WeakMap<vue.Embedded, [number, EmbeddedDocumentSourceMap]>();

	// computed
	const document = computed(() => TextDocument.create(
		shared.getUriByPath(rootUri, vueFile.fileName),
		vueFile.fileName.endsWith('.md') ? 'markdown' : 'vue',
		documentVersion++,
		vueFile.text,
	));
	const allSourceMaps = computed(() => {
		return vueFile.allEmbeddeds.map(getSourceMap);
	});
	const teleports = computed(() => {
		return vueFile.teleports.map(teleportAndFile => {
			const embeddedDocument = getEmbeddedDocument(teleportAndFile.file)!;
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
		uri: shared.getUriByPath(rootUri, vueFile.fileName),
		file: vueFile,
		getSourceMap,
		getEmbeddedDocument,
		getTemplateData,
		getSourceMaps: () => allSourceMaps.value,
		getTeleports: () => teleports.value,
		getDocument: () => document.value,
		getTemplateTagsAndAttrs: () => templateTagsAndAttrs.value,
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

	async function getTemplateData() {

		const options: ts.GetCompletionsAtPositionOptions = {
			includeCompletionsWithInsertText: true, // if missing, { 'aaa-bbb': any, ccc: any } type only has result ['ccc']
		};

		const file = vueFile.allEmbeddeds.find(e => e.file.fileName === vueFile.tsFileName)?.file;
		if (file && file.codeGen.getText().indexOf(vue.SearchTexts.Components) >= 0) {
			const document = getEmbeddedDocument(file);

			let components = await tsLs?.doComplete(
				shared.getUriByPath(rootUri, file!.fileName),
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
