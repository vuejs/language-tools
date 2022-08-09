import { EmbeddedFileMappingData, TeleportMappingData, TextRange, VueCompilerOptions, _VueCompilerOptions } from './types';
import { parseRefSugarCallRanges, parseRefSugarDeclarationRanges } from './parsers/refSugarRanges';
import { parseScriptRanges } from './parsers/scriptRanges';
import { parseScriptSetupRanges } from './parsers/scriptSetupRanges';
import { SFCBlock, SFCParseResult, SFCScriptBlock, SFCStyleBlock, SFCTemplateBlock } from '@vue/compiler-sfc';
import { computed, ComputedRef, reactive, ref, unref } from '@vue/reactivity';
import { EmbeddedFileSourceMap, Teleport } from './utils/sourceMaps';
import { SearchTexts } from './utils/string';
import * as templateGen from './generators/template';
import { parseCssClassNames } from './utils/parseCssClassNames';
import { parseCssVars } from './utils/parseCssVars';

import useVueFilePlugin from './plugins/file-vue';
import useMdFilePlugin from './plugins/file-md';
import useHtmlFilePlugin from './plugins/file-html';
import useHtmlPlugin from './plugins/vue-template-html';
import usePugPlugin from './plugins/vue-template-pug';
import useVueSfcStyles from './plugins/vue-sfc-styles';
import useVueSfcCustomBlocks from './plugins/vue-sfc-customblocks';
import useVueSfcScriptsFormat from './plugins/vue-sfc-scripts';
import useVueSfcTemplate from './plugins/vue-sfc-template';
import useVueTsx from './plugins/vue-tsx';

import type * as ts from 'typescript/lib/tsserverlibrary'; // fix TS2742
import { Mapping, MappingBase } from '@volar/source-map';
import { CodeGen } from '@volar/code-gen';
import * as CompilerDom from '@vue/compiler-dom';
import { getVueCompilerOptions } from './utils/ts';

export type VueLanguagePlugin = (ctx: {
	ts: typeof ts,
	compilerOptions: ts.CompilerOptions,
	vueCompilerOptions: _VueCompilerOptions,
}) => {

	parseSFC?(fileName: string, content: string): SFCParseResult | undefined;

	compileSFCTemplate?(lang: string, template: string, options?: CompilerDom.CompilerOptions): CompilerDom.CodegenResult | undefined;

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
}

export interface EmbeddedFile {
	parentFileName?: string,
	fileName: string,
	isTsHostFile: boolean,
	capabilities: {
		diagnostics: boolean,
		foldingRanges: boolean,
		formatting: boolean,
		documentSymbol: boolean,
		codeActions: boolean,
		inlayHints: boolean,
	},
	codeGen: CodeGen<EmbeddedFileMappingData>,
	teleportMappings: Mapping<TeleportMappingData>[],
};

export function createSourceFile(
	fileName: string,
	_content: string,
	compilerOptions: ts.CompilerOptions,
	vueCompilerOptions: VueCompilerOptions,
	ts: typeof import('typescript/lib/tsserverlibrary'),
	extraPlugins: VueLanguagePlugin[] = [],
) {

	// refs
	const fileContent = ref('');
	const sfc = reactive<Sfc>({
		template: null,
		script: null,
		scriptSetup: null,
		styles: [],
		customBlocks: [],
	}) as Sfc /* avoid Sfc unwrap in .d.ts by reactive */;

	// use
	const parsedSfc = computed(() => {
		for (const plugin of plugins) {
			const sfc = plugin.parseSFC?.(fileName, fileContent.value);
			if (sfc) {
				return sfc;
			}
		}
	});
	const templateAstCompiled = computed(() => {
		if (sfc.template) {
			for (const plugin of plugins) {

				const errors: CompilerDom.CompilerError[] = [];
				const warnings: CompilerDom.CompilerError[] = [];
				let ast: CompilerDom.RootNode | undefined;

				try {
					ast = plugin.compileSFCTemplate?.(sfc.template.lang, sfc.template.content, {
						onError: (err: CompilerDom.CompilerError) => errors.push(err),
						onWarn: (err: CompilerDom.CompilerError) => warnings.push(err),
						expressionPlugins: ['typescript'],
						...vueCompilerOptions.experimentalTemplateCompilerOptions,
					})?.ast;
				}
				catch (e) {
					const err = e as CompilerDom.CompilerError;
					errors.push(err);
				}


				if (ast || errors.length) {
					return {
						errors,
						warnings,
						ast,
					};
				}
			}
		}
	});
	const cssModuleClasses = useStyleCssClasses(sfc, style => !!style.module);
	const cssScopedClasses = useStyleCssClasses(sfc, style => {
		const setting = compilerOptions.experimentalResolveStyleCssClasses ?? 'scoped';
		return (setting === 'scoped' && style.scoped) || setting === 'always';
	});
	const templateCodeGens = computed(() => {

		if (!templateAstCompiled.value?.ast)
			return;

		return templateGen.generate(
			ts,
			{
				target: vueCompilerOptions.target ?? 3,
				strictTemplates: vueCompilerOptions.strictTemplates ?? false,
				experimentalRuntimeMode: vueCompilerOptions.experimentalRuntimeMode,
				experimentalAllowTypeNarrowingInInlineHandlers: vueCompilerOptions.experimentalAllowTypeNarrowingInInlineHandlers ?? false,
			},
			sfc.template?.lang ?? 'html',
			templateAstCompiled.value.ast,
			!!sfc.scriptSetup,
			Object.values(cssScopedClasses.value).map(style => style.classNames).flat(),
			{
				getEmitCompletion: SearchTexts.EmitCompletion,
				getPropsCompletion: SearchTexts.PropsCompletion,
			}
		);
	});
	const cssVars = useCssVars(sfc);
	const scriptAst = computed(() => {
		if (sfc.script) {
			return ts.createSourceFile(fileName + '.' + sfc.script.lang, sfc.script.content, ts.ScriptTarget.Latest);
		}
	});
	const scriptSetupAst = computed(() => {
		if (sfc.scriptSetup) {
			return ts.createSourceFile(fileName + '.' + sfc.scriptSetup.lang, sfc.scriptSetup.content, ts.ScriptTarget.Latest);
		}
	});
	const scriptRanges = computed(() =>
		scriptAst.value
			? parseScriptRanges(ts, scriptAst.value, !!sfc.scriptSetup, false, false)
			: undefined
	);
	const scriptSetupRanges = computed(() =>
		scriptSetupAst.value
			? parseScriptSetupRanges(ts, scriptSetupAst.value)
			: undefined
	);
	const sfcRefSugarRanges = computed(() => (scriptSetupAst.value ? {
		refs: parseRefSugarDeclarationRanges(ts, scriptSetupAst.value, ['$ref', '$computed', '$shallowRef', '$fromRefs']),
		raws: parseRefSugarCallRanges(ts, scriptSetupAst.value, ['$raw', '$fromRefs']),
	} : undefined));

	const _plugins: VueLanguagePlugin[] = [
		...extraPlugins,
		useVueFilePlugin,
		useMdFilePlugin,
		useHtmlFilePlugin,
		useHtmlPlugin,
		usePugPlugin,
		useVueSfcStyles,
		useVueSfcCustomBlocks,
		useVueSfcScriptsFormat,
		useVueSfcTemplate,
		useVueTsx(
			ts,
			scriptRanges,
			scriptSetupRanges,
			templateCodeGens,
			vueCompilerOptions,
			cssVars,
			cssModuleClasses,
			cssScopedClasses,
			!!vueCompilerOptions.experimentalDisableTemplateSupport || compilerOptions.jsx !== ts.JsxEmit.Preserve,
		),
	];
	const pluginCtx: Parameters<VueLanguagePlugin>[0] = {
		ts,
		compilerOptions,
		vueCompilerOptions: getVueCompilerOptions(vueCompilerOptions),
	};
	const plugins = _plugins.map(plugin => plugin(pluginCtx));

	// computeds
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
			// 	throw 'Unable to resolve embeddeds: ' + remain[0].parentFileName + ' -> ' + remain[0].file.fileName;
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

	update(_content);

	return {
		fileName,
		get text() {
			return fileContent.value;
		},
		set text(value) {
			update(value);
		},
		getSfcVueTemplateCompiled: () => templateAstCompiled.value,
		getScriptFileName: () => allEmbeddeds.value.find(e => e.file.fileName.replace(fileName, '').match(/^\.(js|ts)x?$/))?.file.fileName,
		getDescriptor: () => unref(sfc),
		getScriptAst: () => scriptAst.value,
		getScriptSetupAst: () => scriptSetupAst.value,
		getSfcRefSugarRanges: () => sfcRefSugarRanges.value,
		getEmbeddeds: () => embeddeds.value,
		getScriptSetupRanges: () => scriptSetupRanges.value,
		isJsxMissing: () => !vueCompilerOptions.experimentalDisableTemplateSupport && compilerOptions.jsx !== ts.JsxEmit.Preserve,

		getAllEmbeddeds: () => allEmbeddeds.value,
		getTeleports: () => teleports.value,
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
	function update(newContent: string) {

		if (fileContent.value === newContent)
			return;

		fileContent.value = newContent;

		// TODO: wait for https://github.com/vuejs/core/pull/5912
		if (parsedSfc.value) {
			updateTemplate(parsedSfc.value.descriptor.template);
			updateScript(parsedSfc.value.descriptor.script);
			updateScriptSetup(parsedSfc.value.descriptor.scriptSetup);
			updateStyles(parsedSfc.value.descriptor.styles);
			updateCustomBlocks(parsedSfc.value.descriptor.customBlocks);
		}

		function updateTemplate(block: SFCTemplateBlock | null) {

			const newData: Sfc['template'] | null = block ? {
				tag: 'template',
				start: newContent.substring(0, block.loc.start.offset).lastIndexOf('<'),
				end: block.loc.end.offset + newContent.substring(block.loc.end.offset).indexOf('>') + 1,
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
				start: newContent.substring(0, block.loc.start.offset).lastIndexOf('<'),
				end: block.loc.end.offset + newContent.substring(block.loc.end.offset).indexOf('>') + 1,
				startTagEnd: block.loc.start.offset,
				endTagStart: block.loc.end.offset,
				content: block.content,
				lang: getValidScriptSyntax(block.lang ?? 'js'),
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
				start: newContent.substring(0, block.loc.start.offset).lastIndexOf('<'),
				end: block.loc.end.offset + newContent.substring(block.loc.end.offset).indexOf('>') + 1,
				startTagEnd: block.loc.start.offset,
				endTagStart: block.loc.end.offset,
				content: block.content,
				lang: getValidScriptSyntax(block.lang ?? 'js'),
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
					start: newContent.substring(0, block.loc.start.offset).lastIndexOf('<'),
					end: block.loc.end.offset + newContent.substring(block.loc.end.offset).indexOf('>') + 1,
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
					start: newContent.substring(0, block.loc.start.offset).lastIndexOf('<'),
					end: block.loc.end.offset + newContent.substring(block.loc.end.offset).indexOf('>') + 1,
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

export function useStyleCssClasses(sfc: Sfc, condition: (style: Sfc['styles'][number]) => boolean) {
	return computed(() => {
		const result: {
			style: typeof sfc.styles[number],
			index: number,
			classNameRanges: TextRange[],
			classNames: string[],
		}[] = [];
		for (let i = 0; i < sfc.styles.length; i++) {
			const style = sfc.styles[i];
			if (condition(style)) {
				const classNameRanges = [...parseCssClassNames(style.content)];
				result.push({
					style: style,
					index: i,
					classNameRanges: classNameRanges,
					classNames: classNameRanges.map(range => style.content.substring(range.start + 1, range.end)),
				});
			}
		}
		return result;
	});
}

export function useCssVars(sfc: Sfc) {
	return computed(() => {
		const result: { style: typeof sfc.styles[number], styleIndex: number, ranges: TextRange[]; }[] = [];
		for (let i = 0; i < sfc.styles.length; i++) {
			const style = sfc.styles[i];
			result.push({
				style: style,
				styleIndex: i,
				ranges: [...parseCssVars(style.content)],
			});
		}
		return result;
	});
}

const validScriptSyntaxs = ['js', 'jsx', 'ts', 'tsx'] as const;

type ValidScriptSyntax = typeof validScriptSyntaxs[number];

function getValidScriptSyntax(syntax: string): ValidScriptSyntax {
	if (validScriptSyntaxs.includes(syntax as ValidScriptSyntax)) {
		return syntax as ValidScriptSyntax;
	}
	return 'js';
}
