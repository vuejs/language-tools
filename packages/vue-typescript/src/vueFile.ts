import { compileSFCTemplate, EmbeddedFileMappingData, TextRange } from '@volar/vue-code-gen';
import { parseRefSugarCallRanges, parseRefSugarDeclarationRanges } from '@volar/vue-code-gen/out/parsers/refSugarRanges';
import { parseScriptRanges } from '@volar/vue-code-gen/out/parsers/scriptRanges';
import { parseScriptSetupRanges } from '@volar/vue-code-gen/out/parsers/scriptSetupRanges';
import { parse, SFCBlock, SFCScriptBlock, SFCStyleBlock, SFCTemplateBlock } from '@vue/compiler-sfc';
import { computed, ComputedRef, reactive, ref, unref } from '@vue/reactivity';
import { ITemplateScriptData, VueCompilerOptions } from './types';
import { EmbeddedFileSourceMap, Teleport } from './utils/sourceMaps';
import { SearchTexts } from './utils/string';
import { untrack } from './utils/untrack';
import * as templateGen from '@volar/vue-code-gen/out/generators/template';
import { parseCssClassNames } from './utils/parseCssClassNames';
import { parseCssVars } from './utils/parseCssVars';

import useVueFilePlugin from './plugins/file-vue';
import useMdFilePlugin from './plugins/file-md';
import useHtmlPlugin from './plugins/vue-template-html';
import usePugPlugin from './plugins/vue-template-pug';
import useVueSfcStyles from './plugins/vue-sfc-styles';
import useVueSfcCustomBlocks from './plugins/vue-sfc-customblocks';
import useVueSfcScriptsFormat from './plugins/vue-sfc-scripts';
import useVueSfcTemplate from './plugins/vue-sfc-template';
import useVueTsScripts from './plugins/vue-typescript-scripts';
import useVueTsTemplate from './plugins/vue-typescript-template';

import type * as _0 from 'typescript/lib/tsserverlibrary'; // fix TS2742
import { Mapping, MappingBase } from '@volar/source-map';

export interface VueLanguagePlugin {

	compileFileToVue?(fileName: string, content: string): {
		vue: string,
		mapping(vueRange: { start: number, end: number; }): { start: number, end: number; } | undefined,
	} | undefined;

	compileTemplateToHtml?(lang: string, tmplate: string): {
		html: string,
		mapping(htmlRange: { start: number, end: number; }): { start: number, end: number; } | undefined,
	} | undefined;

	// TODO: compileHtmlTemplateToAst

	getEmbeddedFilesCount?(sfc: Sfc): number;

	getEmbeddedFile?(fileName: string, sfc: Sfc, i: number): Embedded | undefined;
}

export interface VueFile extends ReturnType<typeof createVueFile> { }

export interface EmbeddedStructure {
	self: Embedded | undefined,
	embeddeds: EmbeddedStructure[],
	inheritParentIndent?: boolean,
}

export interface Embedded {
	parentFileName?: string,
	file: EmbeddedFile,
	sourceMap: EmbeddedFileSourceMap,
	teleport?: Teleport,
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
	fileName: string,
	lang: string,
	content: string,
	isTsHostFile: boolean,
	capabilities: {
		diagnostics: boolean,
		foldingRanges: boolean,
		formatting: boolean,
		documentSymbol: boolean,
		codeActions: boolean,
		inlayHints: boolean,
	},
};

export function createVueFile(
	fileName: string,
	_content: string,
	_version: string,
	compilerOptions: VueCompilerOptions,
	ts: typeof import('typescript/lib/tsserverlibrary'),
	tsLs: ts.LanguageService | undefined,
	tsHost: ts.LanguageServiceHost | undefined,
) {

	// refs
	const fileContent = ref('');
	const version = ref('');
	const sfc = reactive<Sfc>({
		template: null,
		script: null,
		scriptSetup: null,
		styles: [],
		customBlocks: [],
	}) as Sfc /* avoid Sfc unwrap in .d.ts by reactive */;
	let templateScriptData: ITemplateScriptData = {
		projectVersion: undefined,
		components: [],
		componentItems: [],
	};

	// use
	const compiledVue = computed<ReturnType<NonNullable<VueLanguagePlugin['compileFileToVue']>>>(() => {
		for (const plugin of plugins) {
			const compiled = plugin.compileFileToVue?.(fileName, fileContent.value);
			if (compiled) {
				return compiled;
			}
		}
		// given dummy result to avoid language server throw
		return {
			vue: '<template></template>',
			mapping: vueRange => vueRange,
		};
	});
	const vueContent = computed(() => compiledVue.value?.vue);
	const parsedSfc = computed(() => vueContent.value !== undefined ? parse(vueContent.value, { sourceMap: false, ignoreEmpty: false }) : undefined);
	const computedHtmlTemplate = computed<ReturnType<NonNullable<VueLanguagePlugin['compileTemplateToHtml']>>>(() => {
		if (sfc.template) {
			for (const plugin of plugins) {
				const compiledHtml = plugin.compileTemplateToHtml?.(sfc.template.lang, sfc.template.content);
				if (compiledHtml) {
					return compiledHtml;
				};
			}
		}
	});
	const templateAstCompiled = computed(() => {
		if (computedHtmlTemplate.value) {
			return compileSFCTemplate(
				computedHtmlTemplate.value.html,
				compilerOptions.experimentalTemplateCompilerOptions,
				compilerOptions.experimentalCompatMode ?? 3,
			);
		}
	});
	const cssModuleClasses = useCssModuleClasses(sfc);
	const cssScopedClasses = useCssScopedClasses(sfc, compilerOptions);
	const templateCodeGens = computed(() => {

		if (!computedHtmlTemplate.value)
			return;
		if (!templateAstCompiled.value?.ast)
			return;

		return templateGen.generate(
			ts,
			sfc.template?.lang ?? 'html',
			templateAstCompiled.value.ast,
			compilerOptions.experimentalCompatMode ?? 3,
			compilerOptions.experimentalRuntimeMode,
			!!compilerOptions.experimentalAllowTypeNarrowingInInlineHandlers,
			!!sfc.scriptSetup,
			Object.values(cssScopedClasses.value).map(map => Object.keys(map)).flat(),
			computedHtmlTemplate.value.mapping,
			{
				getEmitCompletion: SearchTexts.EmitCompletion,
				getPropsCompletion: SearchTexts.PropsCompletion,
			}
		);
	});
	const cssVars = useCssVars(sfc);
	const cssVarTexts = computed(() => {
		const result: string[] = [];
		for (const { style, ranges } of cssVars.value) {
			for (const range of ranges) {
				result.push(style.content.substring(range.start, range.end));
			}
		}
		return result;
	});
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
	const scriptLang = computed(() => {
		return !sfc.script && !sfc.scriptSetup ? 'ts'
			: sfc.scriptSetup && sfc.scriptSetup.lang !== 'js' ? sfc.scriptSetup.lang
				: sfc.script && sfc.script.lang !== 'js' ? sfc.script.lang
					: 'js';
	});
	const sfcRefSugarRanges = computed(() => (scriptSetupAst.value ? {
		refs: parseRefSugarDeclarationRanges(ts, scriptSetupAst.value, ['$ref', '$computed', '$shallowRef', '$fromRefs']),
		raws: parseRefSugarCallRanges(ts, scriptSetupAst.value, ['$raw', '$fromRefs']),
	} : undefined));

	const plugins: VueLanguagePlugin[] = [
		useVueFilePlugin(),
		useMdFilePlugin(),
		useHtmlPlugin(),
		usePugPlugin(),
		useVueSfcStyles(),
		useVueSfcCustomBlocks(),
		useVueSfcScriptsFormat(),
		useVueSfcTemplate(),
		useVueTsScripts(
			scriptLang,
			scriptRanges,
			scriptSetupRanges,
			templateCodeGens,
			compilerOptions,
			cssVarTexts,
		),
		useVueTsTemplate(
			ts,
			cssModuleClasses,
			cssScopedClasses,
			templateCodeGens,
			cssVars,
			scriptSetupRanges,
			scriptLang,
			compilerOptions,
			!!compilerOptions.experimentalDisableTemplateSupport || !(tsHost?.getCompilationSettings().jsx === ts.JsxEmit.Preserve),
		),
	];

	// computeds
	const pluginEmbeddeds = plugins.map(plugin => {
		if (plugin.getEmbeddedFilesCount && plugin.getEmbeddedFile) {
			const embeddedsCount = computed(() => plugin.getEmbeddedFilesCount!(sfc));
			const embeddeds = computed(() => {
				const computeds: ComputedRef<Embedded | undefined>[] = [];
				for (let i = 0; i < embeddedsCount.value; i++) {
					const _i = i;
					const raw = computed(() => plugin.getEmbeddedFile!(fileName, sfc, _i));
					const transformed = computed(() => {

						if (!raw.value)
							return;

						const sourceMap = raw.value.sourceMap;
						const newMappings: typeof sourceMap.mappings = [];
						for (const mapping of sourceMap.mappings) {
							const sourceRange = parseMappingSourceRange(mapping.data, mapping.sourceRange);
							if (sourceRange) {
								let additional: MappingBase[] | undefined;
								if (mapping.additional) {
									additional = [];
									for (const add of mapping.additional) {
										const addSourceRange = parseMappingSourceRange(mapping.data, add.sourceRange);
										if (addSourceRange) {
											additional.push({
												...add,
												sourceRange: addSourceRange,
											});
										}
									}
								}
								newMappings.push({
									...mapping,
									sourceRange,
									additional,
								});
							}
						}
						const newSourceMap = new EmbeddedFileSourceMap(newMappings);
						const newEmbedded: Embedded = {
							file: raw.value.file,
							teleport: raw.value.teleport,
							sourceMap: newSourceMap,
						};
						return newEmbedded;
					});
					computeds.push(transformed);
				}
				return computeds;
			});
			return embeddeds;
		}
	}).filter(notEmpty);
	const allEmbeddeds = computed(() => {

		const all: Embedded[] = [];

		for (const getEmbeddeds of pluginEmbeddeds) {
			for (const embedded of getEmbeddeds.value) {
				if (embedded.value) {
					all.push(embedded.value);
				}
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

		if (remain.length) {
			throw 'Unable to resolve embeddeds: ' + remain[0].parentFileName + ' -> ' + remain[0].file.fileName;
		}

		return embeddeds;

		function consumeRemain() {
			for (let i = remain.length - 1; i >= 0; i--) {
				const embedded = remain[i];
				if (!embedded.parentFileName) {
					embeddeds.push({
						self: embedded,
						embeddeds: [],
					});
					remain.splice(i, 1);
				}
				else {
					const parent = findParentStructure(embedded.parentFileName, embeddeds);
					if (parent) {
						parent.embeddeds.push({
							self: embedded,
							inheritParentIndent: true,
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

	update(_content, _version);

	return {
		fileName,
		getContent: untrack(() => fileContent.value),
		getSfcTemplateLanguageCompiled: untrack(() => computedHtmlTemplate.value),
		getSfcVueTemplateCompiled: untrack(() => templateAstCompiled.value),
		getVersion: untrack(() => version.value),
		update: untrack(update),
		getTemplateData: untrack(getTemplateData),
		getScriptFileName: untrack(() => fileName + '.' + scriptLang.value),
		getDescriptor: untrack(() => unref(sfc)),
		getScriptAst: untrack(() => scriptAst.value),
		getScriptSetupAst: untrack(() => scriptSetupAst.value),
		getSfcRefSugarRanges: untrack(() => sfcRefSugarRanges.value),
		getEmbeddeds: untrack(() => embeddeds.value),
		getAllEmbeddeds: untrack(() => allEmbeddeds.value),
		getScriptSetupRanges: untrack(() => scriptSetupRanges.value),
		isJsxMissing: () => !compilerOptions.experimentalDisableTemplateSupport && !(tsHost?.getCompilationSettings().jsx === ts.JsxEmit.Preserve),

		refs: {
			content: fileContent,
			allEmbeddeds,
			teleports,
		},
	};

	function parseMappingSourceRange(data: EmbeddedFileMappingData, range: Mapping<unknown>['sourceRange']) {

		if (!compiledVue.value) throw '!compiledVue.value';
		if (vueContent.value === undefined) throw 'vueContent.value === undefined';

		if (data.vueTag === 'scriptSrc') {
			if (!sfc.script?.src) throw '!sfc.script?.src';
			const vueStart = vueContent.value.substring(0, sfc.script.startTagEnd).lastIndexOf(sfc.script.src);
			const vueEnd = vueStart + sfc.script.src.length;
			return compiledVue.value.mapping({
				start: vueStart - 1,
				end: vueEnd + 1,
			});
		}
		else if (data.vueTag === 'script') {
			if (!sfc.script) throw '!sfc.script';
			return compiledVue.value.mapping({
				start: sfc.script.startTagEnd + range.start,
				end: sfc.script.startTagEnd + range.end,
			});
		}
		else if (data.vueTag === 'scriptSetup') {
			if (!sfc.scriptSetup) throw '!sfc.scriptSetup';
			return compiledVue.value.mapping({
				start: sfc.scriptSetup.startTagEnd + range.start,
				end: sfc.scriptSetup.startTagEnd + range.end,
			});
		}
		else if (data.vueTag === 'template') {
			if (!sfc.template) throw '!sfc.template';
			return compiledVue.value.mapping({
				start: sfc.template.startTagEnd + range.start,
				end: sfc.template.startTagEnd + range.end,
			});
		}
		else if (data.vueTag === 'style') {
			if (data.vueTagIndex === undefined) throw 'data.vueTagIndex === undefined';
			return compiledVue.value.mapping({
				start: sfc.styles[data.vueTagIndex].startTagEnd + range.start,
				end: sfc.styles[data.vueTagIndex].startTagEnd + range.end,
			});
		}
		else if (data.vueTag === 'customBlock') {
			if (data.vueTagIndex === undefined) throw 'data.vueTagIndex === undefined';
			return compiledVue.value.mapping({
				start: sfc.customBlocks[data.vueTagIndex].startTagEnd + range.start,
				end: sfc.customBlocks[data.vueTagIndex].startTagEnd + range.end,
			});
		}
		return compiledVue.value.mapping(range);
	}
	function update(newContent: string, newVersion: string) {

		const oldScripts: Record<string, string> = {};

		for (const embedded of allEmbeddeds.value) {
			if (embedded.file.isTsHostFile) {
				oldScripts[embedded.file.fileName] = embedded.file.content;
			}
		}

		fileContent.value = newContent;
		version.value = newVersion;

		// TODO: wait for https://github.com/vuejs/core/pull/5912
		if (parsedSfc.value) {
			updateTemplate(parsedSfc.value.descriptor.template);
			updateScript(parsedSfc.value.descriptor.script);
			updateScriptSetup(parsedSfc.value.descriptor.scriptSetup);
			updateStyles(parsedSfc.value.descriptor.styles);
			updateCustomBlocks(parsedSfc.value.descriptor.customBlocks);
		}

		const newScripts: Record<string, string> = {};

		for (const embedded of allEmbeddeds.value) {
			if (embedded.file.isTsHostFile) {
				newScripts[embedded.file.fileName] = embedded.file.content;
			}
		}

		return {
			scriptUpdated: Object.keys(oldScripts).length !== Object.keys(newScripts).length
				|| Object.keys(oldScripts).some(fileName => oldScripts[fileName] !== newScripts[fileName]),
		};

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
	function getTemplateData() {

		if (!tsHost)
			return templateScriptData;

		if (!tsLs)
			return templateScriptData;

		const newVersion = tsHost.getProjectVersion?.();
		if (templateScriptData.projectVersion === newVersion) {
			return templateScriptData;
		}
		templateScriptData.projectVersion = newVersion;

		const options: ts.GetCompletionsAtPositionOptions = {
			includeCompletionsWithInsertText: true, // if missing, { 'aaa-bbb': any, ccc: any } type only has result ['ccc']
		};

		const file = allEmbeddeds.value.find(e => e.file.fileName.indexOf('.__VLS_template.') >= 0)?.file;
		const hasFile = file &&
			file.content.indexOf(SearchTexts.Components) >= 0 &&
			// getSourceFile return undefined for lang=js with allowJs=false;
			!!tsLs.getProgram()?.getSourceFile(file.fileName);

		let components = hasFile ? tsLs.getCompletionsAtPosition(file!.fileName, file!.content.indexOf(SearchTexts.Components), options)?.entries.filter(entry => entry.kind !== ts.ScriptElementKind.warning) ?? [] : [];

		components = components.filter(entry => {
			return entry.name.indexOf('$') === -1 && !entry.name.startsWith('_');
		});

		const componentNames = components.map(entry => entry.name);

		templateScriptData = {
			projectVersion: newVersion,
			components: componentNames,
			componentItems: components,
		};

		return templateScriptData;
	}
}

export function useCssModuleClasses(sfc: Sfc) {
	return computed(() => {
		const result: { style: typeof sfc.styles[number], index: number, classNameRanges: TextRange[]; }[] = [];
		for (let i = 0; i < sfc.styles.length; i++) {
			const style = sfc.styles[i];
			if (style.module) {
				result.push({
					style: style,
					index: i,
					classNameRanges: [...parseCssClassNames(style.content)],
				});
			}
		}
		return result;
	});
}

export function useCssScopedClasses(sfc: Sfc, compilerOptions: VueCompilerOptions) {
	return computed(() => {
		const result: { style: typeof sfc.styles[number], index: number, classNameRanges: TextRange[]; }[] = [];
		const setting = compilerOptions.experimentalResolveStyleCssClasses ?? 'scoped';
		for (let i = 0; i < sfc.styles.length; i++) {
			const style = sfc.styles[i];
			if ((setting === 'scoped' && style.scoped) || setting === 'always') {
				result.push({
					style: style,
					index: i,
					classNameRanges: [...parseCssClassNames(style.content)],
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

function notEmpty<T>(value: T | null | undefined): value is T {
	return value !== null && value !== undefined;
}
