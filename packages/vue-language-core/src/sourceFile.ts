import { SFCBlock, SFCParseResult, SFCScriptBlock, SFCStyleBlock, SFCTemplateBlock } from '@vue/compiler-sfc';
import { computed, ComputedRef, reactive, shallowRef as ref, pauseTracking, resetTracking } from '@vue/reactivity';
import { EmbeddedFileMappingData, TeleportMappingData, _VueCompilerOptions } from './types';
import { EmbeddedFileSourceMap, Teleport } from './utils/sourceMaps';

import { CodeGen } from '@volar/code-gen';
import { Mapping, MappingBase } from '@volar/source-map';
import * as CompilerDom from '@vue/compiler-dom';
import type * as ts from 'typescript/lib/tsserverlibrary';

export type VueLanguagePlugin = (ctx: {
	modules: {
		typescript: typeof import('typescript/lib/tsserverlibrary');
	},
	compilerOptions: ts.CompilerOptions,
	vueCompilerOptions: _VueCompilerOptions,
}) => {
	order?: number;
	parseSFC?(fileName: string, content: string): SFCParseResult | undefined;
	updateSFC?(oldResult: SFCParseResult, textChange: { start: number, end: number, newText: string; }): SFCParseResult | undefined;
	compileSFCTemplate?(lang: string, template: string, options?: CompilerDom.CompilerOptions): CompilerDom.CodegenResult | undefined;
	updateSFCTemplate?(oldResult: CompilerDom.CodegenResult, textChange: { start: number, end: number, newText: string; }): CompilerDom.CodegenResult | undefined;
	getEmbeddedFileNames?(fileName: string, sfc: Sfc): string[];
	resolveEmbeddedFile?(fileName: string, sfc: Sfc, embeddedFile: EmbeddedFile): void;
};

export interface SourceFile extends ReturnType<typeof createSourceFile> { }

export interface EmbeddedStructure {
	self: Embedded | undefined,
	embeddeds: EmbeddedStructure[],
}

export interface Embedded {
	file: EmbeddedFile,
	sourceMap: EmbeddedFileSourceMap,
	teleport: Teleport | undefined,
}

export interface SfcBlock {
	tag: 'script' | 'scriptSetup' | 'template' | 'style' | 'customBlock',
	start: number;
	end: number;
	startTagEnd: number;
	endTagStart: number;
	lang: string;
	content: string;
}

export interface Sfc {
	template: SfcBlock | null;
	script: (SfcBlock & {
		src: string | undefined;
	}) | null;
	scriptSetup: SfcBlock | null;
	styles: (SfcBlock & {
		module: string | undefined;
		scoped: boolean;
	})[];
	customBlocks: (SfcBlock & {
		type: string;
	})[];

	// ast
	templateAst: CompilerDom.RootNode | undefined;
	scriptAst: ts.SourceFile | undefined;
	scriptSetupAst: ts.SourceFile | undefined;
}

export interface EmbeddedFile {
	parentFileName?: string,
	fileName: string,
	isTsHostFile: boolean,
	capabilities: {
		diagnostics: boolean,
		foldingRanges: boolean,
		formatting: boolean | {
			initialIndentBracket?: [string, string],
		},
		documentSymbol: boolean,
		codeActions: boolean,
		inlayHints: boolean,
	},
	codeGen: CodeGen<EmbeddedFileMappingData>,
	teleportMappings: Mapping<TeleportMappingData>[],
};

export function createSourceFile(
	fileName: string,
	scriptSnapshot: ts.IScriptSnapshot,
	ts: typeof import('typescript/lib/tsserverlibrary'),
	plugins: ReturnType<VueLanguagePlugin>[],
) {

	// refs
	const snapshot = ref(scriptSnapshot);
	const fileContent = computed(() => snapshot.value.getText(0, snapshot.value.getLength()));
	const sfc = reactive<Sfc>({
		template: null,
		script: null,
		scriptSetup: null,
		styles: [],
		customBlocks: [],
		templateAst: computed(() => {
			return compiledSFCTemplate.value?.ast;
		}) as unknown as Sfc['templateAst'],
		scriptAst: computed(() => {
			if (sfc.script) {
				return ts.createSourceFile(fileName + '.' + sfc.script.lang, sfc.script.content, ts.ScriptTarget.Latest);
			}
		}) as unknown as Sfc['scriptAst'],
		scriptSetupAst: computed(() => {
			if (sfc.scriptSetup) {
				return ts.createSourceFile(fileName + '.' + sfc.scriptSetup.lang, sfc.scriptSetup.content, ts.ScriptTarget.Latest);
			}
		}) as unknown as Sfc['scriptSetupAst'],
	}) as Sfc /* avoid Sfc unwrap in .d.ts by reactive */;

	// cache
	let parsedSfcCache: {
		snapshot: ts.IScriptSnapshot,
		sfc: SFCParseResult,
		plugin: ReturnType<VueLanguagePlugin>,
	} | undefined;
	let compiledSFCTemplateCache: {
		snapshot: ts.IScriptSnapshot,
		result: CompilerDom.CodegenResult,
		plugin: ReturnType<VueLanguagePlugin>,
	} | undefined;

	// computeds
	const parsedSfc = computed(() => {

		// incremental update
		if (parsedSfcCache?.plugin.updateSFC) {
			const change = snapshot.value.getChangeRange(parsedSfcCache.snapshot);
			if (change) {
				const newSfc = parsedSfcCache.plugin.updateSFC(parsedSfcCache.sfc, {
					start: change.span.start,
					end: change.span.start + change.span.length,
					newText: snapshot.value.getText(change.span.start, change.span.start + change.newLength),
				});
				if (newSfc) {
					parsedSfcCache.snapshot = snapshot.value;
					parsedSfcCache.sfc = newSfc;
					return newSfc;
				}
			}
		}

		for (const plugin of plugins) {
			const sfc = plugin.parseSFC?.(fileName, fileContent.value);
			if (sfc) {
				if (!sfc.errors.length) {
					parsedSfcCache = {
						snapshot: snapshot.value,
						sfc,
						plugin,
					};
				}
				return sfc;
			}
		}
	});
	const compiledSFCTemplate = computed(() => {

		if (sfc.template) {

			pauseTracking();
			// don't tracking
			const newSnapshot = snapshot.value;
			const templateOffset = sfc.template.startTagEnd;
			resetTracking();

			// tracking
			sfc.template.content;

			// incremental update
			if (compiledSFCTemplateCache?.plugin.updateSFCTemplate) {

				const change = newSnapshot.getChangeRange(compiledSFCTemplateCache.snapshot);

				if (change) {
					const newText = newSnapshot.getText(change.span.start, change.span.start + change.newLength);
					const newResult = compiledSFCTemplateCache.plugin.updateSFCTemplate(compiledSFCTemplateCache.result, {
						start: change.span.start - templateOffset,
						end: change.span.start + change.span.length - templateOffset,
						newText,
					});
					if (newResult) {
						compiledSFCTemplateCache.snapshot = newSnapshot;
						compiledSFCTemplateCache.result = newResult;
						return {
							errors: [],
							warnings: [],
							ast: newResult.ast,
						};
					}
				}
			}

			for (const plugin of plugins) {

				const errors: CompilerDom.CompilerError[] = [];
				const warnings: CompilerDom.CompilerError[] = [];
				let result: CompilerDom.CodegenResult | undefined;

				try {
					result = plugin.compileSFCTemplate?.(sfc.template.lang, sfc.template.content, {
						onError: (err: CompilerDom.CompilerError) => errors.push(err),
						onWarn: (err: CompilerDom.CompilerError) => warnings.push(err),
						expressionPlugins: ['typescript'],
					});
				}
				catch (e) {
					const err = e as CompilerDom.CompilerError;
					errors.push(err);
				}

				if (result || errors.length) {

					if (result && !errors.length && !warnings.length) {
						compiledSFCTemplateCache = {
							snapshot: newSnapshot,
							result: result,
							plugin,
						};
					}

					return {
						errors,
						warnings,
						ast: result?.ast,
					};
				}
			}
		}
	});
	const pluginEmbeddedFiles = plugins.map(plugin => {
		const embeddedFiles: Record<string, ComputedRef<EmbeddedFile>> = {};
		const files = computed(() => {
			if (plugin.getEmbeddedFileNames) {
				const embeddedFileNames = plugin.getEmbeddedFileNames(fileName, sfc);
				for (const oldFileName of Object.keys(embeddedFiles)) {
					if (!embeddedFileNames.includes(oldFileName)) {
						delete embeddedFiles[oldFileName];
					}
				}
				for (const embeddedFileName of embeddedFileNames) {
					if (!embeddedFiles[embeddedFileName]) {
						embeddedFiles[embeddedFileName] = computed(() => {
							const file: EmbeddedFile = {
								fileName: embeddedFileName,
								capabilities: {
									diagnostics: false,
									foldingRanges: false,
									formatting: false,
									documentSymbol: false,
									codeActions: false,
									inlayHints: false,
								},
								isTsHostFile: false,
								codeGen: new CodeGen(),
								teleportMappings: [],
							};
							for (const plugin of plugins) {
								if (plugin.resolveEmbeddedFile) {
									plugin.resolveEmbeddedFile(fileName, sfc, file);
								}
							}
							return file;
						});
					}
				}
			}
			return Object.values(embeddedFiles);
		});
		return computed(() => {
			return files.value.map(_file => {
				const file = _file.value;
				const sourceMap = new EmbeddedFileSourceMap();
				for (const mapping of file.codeGen.mappings) {
					const vueRange = embeddedRangeToVueRange(mapping.data, mapping.sourceRange);
					let additional: MappingBase[] | undefined;
					if (mapping.additional) {
						additional = [];
						for (const add of mapping.additional) {
							const addVueRange = embeddedRangeToVueRange(mapping.data, add.sourceRange);
							additional.push({
								...add,
								sourceRange: addVueRange,
							});
						}
					}
					sourceMap.mappings.push({
						...mapping,
						sourceRange: vueRange,
						additional,
					});
				}
				const embedded: Embedded = {
					file,
					sourceMap,
					teleport: new Teleport(file.teleportMappings),
				};
				return embedded;
			});
		});
	});
	const allEmbeddeds = computed(() => {

		const all: Embedded[] = [];

		for (const embeddedFiles of pluginEmbeddedFiles) {
			for (const embedded of embeddedFiles.value) {
				all.push(embedded);
			}
		}

		return all;
	});
	const teleports = computed(() => {

		const _all: {
			file: EmbeddedFile,
			teleport: Teleport,
		}[] = [];

		for (const embedded of allEmbeddeds.value) {
			if (embedded.teleport) {
				_all.push({
					file: embedded.file,
					teleport: embedded.teleport,
				});
			}
		}

		return _all;
	});
	const embeddeds = computed(() => {

		const embeddeds: EmbeddedStructure[] = [];
		let remain = [...allEmbeddeds.value];

		while (remain.length) {
			const beforeLength = remain.length;
			consumeRemain();
			if (beforeLength === remain.length) {
				break;
			}
		}

		for (const e of remain) {
			embeddeds.push({
				self: e,
				embeddeds: [],
			});
			if (e.file.parentFileName) {
				console.error('Unable to resolve embedded: ' + e.file.parentFileName + ' -> ' + e.file.fileName);
			}
		}

		return embeddeds;

		function consumeRemain() {
			for (let i = remain.length - 1; i >= 0; i--) {
				const embedded = remain[i];
				if (!embedded.file.parentFileName) {
					embeddeds.push({
						self: embedded,
						embeddeds: [],
					});
					remain.splice(i, 1);
				}
				else {
					const parent = findParentStructure(embedded.file.parentFileName, embeddeds);
					if (parent) {
						parent.embeddeds.push({
							self: embedded,
							embeddeds: [],
						});
						remain.splice(i, 1);
					}
				}
			}
		}
		function findParentStructure(fileName: string, strus: EmbeddedStructure[]): EmbeddedStructure | undefined {
			for (const stru of strus) {
				if (stru.self?.file.fileName === fileName) {
					return stru;
				}
				let _stru = findParentStructure(fileName, stru.embeddeds);
				if (_stru) {
					return _stru;
				}
			}
		}
	});

	update(scriptSnapshot, true);

	return {
		fileName,
		get text() {
			return fileContent.value;
		},
		update,
		get compiledSFCTemplate() {
			return compiledSFCTemplate.value;
		},
		get tsFileName() {
			return allEmbeddeds.value.find(e => e.file.fileName.replace(fileName, '').match(/^\.(js|ts)x?$/))?.file.fileName ?? '';
		},
		get sfc() {
			return sfc;
		},
		get embeddeds() {
			return embeddeds.value;
		},
		get allEmbeddeds() {
			return allEmbeddeds.value;
		},
		get teleports() {
			return teleports.value;
		},
	};

	function embeddedRangeToVueRange(data: EmbeddedFileMappingData, range: Mapping<unknown>['sourceRange']) {

		if (data.vueTag === 'scriptSrc') {
			if (!sfc.script?.src) throw '!sfc.script?.src';
			const vueStart = fileContent.value.substring(0, sfc.script.startTagEnd).lastIndexOf(sfc.script.src);
			const vueEnd = vueStart + sfc.script.src.length;
			return {
				start: vueStart - 1,
				end: vueEnd + 1,
			};
		}
		else if (data.vueTag === 'script') {
			if (!sfc.script) throw '!sfc.script';
			return {
				start: range.start + sfc.script.startTagEnd,
				end: range.end + sfc.script.startTagEnd,
			};
		}
		else if (data.vueTag === 'scriptSetup') {
			if (!sfc.scriptSetup) throw '!sfc.scriptSetup';
			return {
				start: range.start + sfc.scriptSetup.startTagEnd,
				end: range.end + sfc.scriptSetup.startTagEnd,
			};
		}
		else if (data.vueTag === 'template') {
			if (!sfc.template) throw '!sfc.template';
			return {
				start: range.start + sfc.template.startTagEnd,
				end: range.end + sfc.template.startTagEnd,
			};
		}
		else if (data.vueTag === 'style') {
			if (data.vueTagIndex === undefined) throw 'data.vueTagIndex === undefined';
			return {
				start: range.start + sfc.styles[data.vueTagIndex].startTagEnd,
				end: range.end + sfc.styles[data.vueTagIndex].startTagEnd,
			};
		}
		else if (data.vueTag === 'customBlock') {
			if (data.vueTagIndex === undefined) throw 'data.vueTagIndex === undefined';
			return {
				start: range.start + sfc.customBlocks[data.vueTagIndex].startTagEnd,
				end: range.end + sfc.customBlocks[data.vueTagIndex].startTagEnd,
			};
		}
		return range;
	}
	function update(newScriptSnapshot: ts.IScriptSnapshot, init = false) {

		if (newScriptSnapshot === snapshot.value && !init) {
			return;
		}

		snapshot.value = newScriptSnapshot;

		// TODO: wait for https://github.com/vuejs/core/pull/5912
		if (parsedSfc.value) {
			updateTemplate(parsedSfc.value.descriptor.template);
			updateScript(parsedSfc.value.descriptor.script);
			updateScriptSetup(parsedSfc.value.descriptor.scriptSetup);
			updateStyles(parsedSfc.value.descriptor.styles);
			updateCustomBlocks(parsedSfc.value.descriptor.customBlocks);
		}
		else {
			updateTemplate(null);
			updateScript(null);
			updateScriptSetup(null);
			updateStyles([]);
			updateCustomBlocks([]);
		}

		function updateTemplate(block: SFCTemplateBlock | null) {

			const newData: Sfc['template'] | null = block ? {
				tag: 'template',
				start: fileContent.value.substring(0, block.loc.start.offset).lastIndexOf('<'),
				end: block.loc.end.offset + fileContent.value.substring(block.loc.end.offset).indexOf('>') + 1,
				startTagEnd: block.loc.start.offset,
				endTagStart: block.loc.end.offset,
				content: block.content,
				lang: block.lang ?? 'html',
			} : null;

			if (sfc.template && newData) {
				updateBlock(sfc.template, newData);
			}
			else {
				sfc.template = newData;
			}
		}
		function updateScript(block: SFCScriptBlock | null) {

			const newData: Sfc['script'] | null = block ? {
				tag: 'script',
				start: fileContent.value.substring(0, block.loc.start.offset).lastIndexOf('<'),
				end: block.loc.end.offset + fileContent.value.substring(block.loc.end.offset).indexOf('>') + 1,
				startTagEnd: block.loc.start.offset,
				endTagStart: block.loc.end.offset,
				content: block.content,
				lang: block.lang ?? 'js',
				src: block.src,
			} : null;

			if (sfc.script && newData) {
				updateBlock(sfc.script, newData);
			}
			else {
				sfc.script = newData;
			}
		}
		function updateScriptSetup(block: SFCScriptBlock | null) {

			const newData: Sfc['scriptSetup'] | null = block ? {
				tag: 'scriptSetup',
				start: fileContent.value.substring(0, block.loc.start.offset).lastIndexOf('<'),
				end: block.loc.end.offset + fileContent.value.substring(block.loc.end.offset).indexOf('>') + 1,
				startTagEnd: block.loc.start.offset,
				endTagStart: block.loc.end.offset,
				content: block.content,
				lang: block.lang ?? 'js',
			} : null;

			if (sfc.scriptSetup && newData) {
				updateBlock(sfc.scriptSetup, newData);
			}
			else {
				sfc.scriptSetup = newData;
			}
		}
		function updateStyles(blocks: SFCStyleBlock[]) {
			for (let i = 0; i < blocks.length; i++) {

				const block = blocks[i];
				const newData: Sfc['styles'][number] = {
					tag: 'style',
					start: fileContent.value.substring(0, block.loc.start.offset).lastIndexOf('<'),
					end: block.loc.end.offset + fileContent.value.substring(block.loc.end.offset).indexOf('>') + 1,
					startTagEnd: block.loc.start.offset,
					endTagStart: block.loc.end.offset,
					content: block.content,
					lang: block.lang ?? 'css',
					module: typeof block.module === 'string' ? block.module : block.module ? '$style' : undefined,
					scoped: !!block.scoped,
				};

				if (sfc.styles.length > i) {
					updateBlock(sfc.styles[i], newData);
				}
				else {
					sfc.styles.push(newData);
				}
			}
			while (sfc.styles.length > blocks.length) {
				sfc.styles.pop();
			}
		}
		function updateCustomBlocks(blocks: SFCBlock[]) {
			for (let i = 0; i < blocks.length; i++) {

				const block = blocks[i];
				const newData: Sfc['customBlocks'][number] = {
					tag: 'customBlock',
					start: fileContent.value.substring(0, block.loc.start.offset).lastIndexOf('<'),
					end: block.loc.end.offset + fileContent.value.substring(block.loc.end.offset).indexOf('>') + 1,
					startTagEnd: block.loc.start.offset,
					endTagStart: block.loc.end.offset,
					content: block.content,
					lang: block.lang ?? 'txt',
					type: block.type,
				};

				if (sfc.customBlocks.length > i) {
					updateBlock(sfc.customBlocks[i], newData);
				}
				else {
					sfc.customBlocks.push(newData);
				}
			}
			while (sfc.customBlocks.length > blocks.length) {
				sfc.customBlocks.pop();
			}
		}
		function updateBlock<T>(oldBlock: T, newBlock: T) {
			for (let key in newBlock) {
				oldBlock[key] = newBlock[key];
			}
		}
	}
}
