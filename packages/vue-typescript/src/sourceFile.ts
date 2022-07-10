import { compileSFCTemplate, EmbeddedFileMappingData, TeleportMappingData, TextRange } from '@volar/vue-code-gen';
import { parseRefSugarCallRanges, parseRefSugarDeclarationRanges } from '@volar/vue-code-gen/out/parsers/refSugarRanges';
import { parseScriptRanges } from '@volar/vue-code-gen/out/parsers/scriptRanges';
import { parseScriptSetupRanges } from '@volar/vue-code-gen/out/parsers/scriptSetupRanges';
import { parse, SFCBlock, SFCScriptBlock, SFCStyleBlock, SFCTemplateBlock } from '@vue/compiler-sfc';
import { computed, ComputedRef, reactive, ref, unref } from '@vue/reactivity';
import { VueCompilerOptions } from './types';
import { EmbeddedFileSourceMap, Teleport } from './utils/sourceMaps';
import { SearchTexts } from './utils/string';
import { untrack } from './utils/untrack';
import * as templateGen from '@volar/vue-code-gen/out/generators/template';
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
import useVueTsScripts from './plugins/vue-typescript-scripts';
import useVueTsTemplate from './plugins/vue-typescript-template';

import type * as _0 from 'typescript/lib/tsserverlibrary'; // fix TS2742
import { Mapping, MappingBase, Mode, SourceMapBase } from '@volar/source-map';

export interface VueLanguagePlugin {

	compileFileToVue?(fileName: string, content: string): {
		vue: string,
		mappings: {
			fileOffset: number,
			vueOffset: number,
			length: number,
		}[],
	} | undefined;

	compileTemplateToHtml?(lang: string, tmplate: string): {
		html: string,
		mapping(htmlRange: { start: number, end: number; }): { start: number, end: number; } | undefined,
	} | undefined;

	// TODO: compileHtmlTemplateToAst

	getEmbeddedFilesCount?(fileName: string, sfc: Sfc): number;

	getEmbeddedFile?(fileName: string, sfc: Sfc, i: number): EmbeddedFile | undefined;
}

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
	mappings: Mapping<EmbeddedFileMappingData>[],
	teleportMappings?: Mapping<TeleportMappingData>[],
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
			mappings: [],
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
				vueCompilerOptions.experimentalTemplateCompilerOptions,
				vueCompilerOptions.target ?? 3,
			);
		}
	});
	const cssModuleClasses = useStyleCssClasses(sfc, style => !!style.module);
	const cssScopedClasses = useStyleCssClasses(sfc, style => {
		const setting = compilerOptions.experimentalResolveStyleCssClasses ?? 'scoped';
		return (setting === 'scoped' && style.scoped) || setting === 'always';
	});
	const templateCodeGens = computed(() => {

		if (!computedHtmlTemplate.value)
			return;
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
		...extraPlugins,
		useVueFilePlugin(),
		useMdFilePlugin(),
		useHtmlFilePlugin(),
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
			vueCompilerOptions,
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
			vueCompilerOptions,
			!!vueCompilerOptions.experimentalDisableTemplateSupport || (compilerOptions.jsx ?? ts.JsxEmit.Preserve) !== ts.JsxEmit.Preserve,
			fileName.endsWith('.html') // petite-vue
		),
	];

	// computeds
	const file2VueSourceMap = computed(() => {
		return new SourceMapBase((compiledVue.value?.mappings ?? []).map(mapping => ({
			data: undefined,
			mode: Mode.Offset,
			sourceRange: {
				start: mapping.fileOffset,
				end: mapping.fileOffset + mapping.length,
			},
			mappedRange: {
				start: mapping.vueOffset,
				end: mapping.vueOffset + mapping.length,
			},
		})));
	});
	const pluginEmbeddeds = plugins.map(plugin => {
		if (plugin.getEmbeddedFilesCount && plugin.getEmbeddedFile) {
			const embeddedsCount = computed(() => plugin.getEmbeddedFilesCount!(fileName, sfc));
			const embeddeds = computed(() => {
				const computeds: ComputedRef<Embedded | undefined>[] = [];
				for (let i = 0; i < embeddedsCount.value; i++) {
					const _i = i;
					const raw = computed(() => {
						return plugin.getEmbeddedFile!(fileName, sfc, _i);
					});
					const transformed = computed(() => {

						if (!raw.value)
							return;

						const newMappings: typeof raw.value.mappings = [];

						for (const mapping of raw.value.mappings) {
							const vueRange = embeddedRangeToVueRange(mapping.data, mapping.sourceRange);
							const fileRange = file2VueSourceMap.value.getSourceRange(vueRange.start, vueRange.end)?.[0];
							if (fileRange) {
								let additional: MappingBase[] | undefined;
								if (mapping.additional) {
									additional = [];
									for (const add of mapping.additional) {
										const addVueRange = embeddedRangeToVueRange(mapping.data, add.sourceRange);
										const addFileRange = file2VueSourceMap.value.getSourceRange(addVueRange.start, addVueRange.end)?.[0];
										if (addFileRange) {
											additional.push({
												...add,
												sourceRange: addFileRange,
											});
										}
									}
								}
								newMappings.push({
									...mapping,
									sourceRange: fileRange,
									additional,
								});
							}
							else if (compiledVue.value) {
								// fix markdown template mapping failed
								const inRangeMappings = compiledVue.value.mappings.filter(mapping => mapping.vueOffset >= vueRange.start && (mapping.vueOffset + mapping.length) <= vueRange.end);
								for (const inRangeMapping of inRangeMappings) {
									const _vueRange = {
										start: inRangeMapping.vueOffset,
										end: inRangeMapping.vueOffset + inRangeMapping.length,
									};
									const _fileRange = {
										start: inRangeMapping.fileOffset,
										end: inRangeMapping.fileOffset + inRangeMapping.length,
									};
									const embedded = vueRangeToEmbeddedRange(mapping.data, _vueRange);
									newMappings.push({
										...mapping,
										sourceRange: _fileRange, // file range
										mappedRange: embedded,
									});
								}
							}
						}
						const newSourceMap = new EmbeddedFileSourceMap(newMappings);
						const newEmbedded: Embedded = {
							file: raw.value,
							sourceMap: newSourceMap,
							teleport: new Teleport(raw.value.teleportMappings),
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
	const embeddedVue = computed(() => {
		if (!fileName.endsWith('.vue') && compiledVue.value) {
			const embeddedFile: EmbeddedFile = {
				fileName: fileName + '.vue',
				content: compiledVue.value.vue,
				capabilities: {
					diagnostics: true,
					foldingRanges: false,
					formatting: false,
					documentSymbol: false,
					codeActions: true,
					inlayHints: true,
				},
				isTsHostFile: false,
				mappings: compiledVue.value.mappings.map(mapping => ({
					data: {
						vueTag: undefined,
						capabilities: {
							basic: true,
							references: true,
							definitions: true,
							diagnostic: true,
							rename: true,
							completion: true,
							semanticTokens: true,
							referencesCodeLens: false,
							displayWithLink: false,
						},
					},
					mode: Mode.Offset,
					sourceRange: {
						start: mapping.fileOffset,
						end: mapping.fileOffset + mapping.length,
					},
					mappedRange: {
						start: mapping.vueOffset,
						end: mapping.vueOffset + mapping.length,
					},
				})),
			};
			const embedded: Embedded = {
				file: embeddedFile,
				sourceMap: new EmbeddedFileSourceMap(embeddedFile.mappings),
				teleport: undefined,
			};
			return embedded;
		}

	});
	const allEmbeddeds = computed(() => {

		const all: Embedded[] = [];

		if (embeddedVue.value) {
			all.push(embeddedVue.value);
		}

		for (const getEmbeddeds of pluginEmbeddeds) {
			for (const embedded of getEmbeddeds.value) {
				if (embedded.value) {
					if (embeddedVue.value && !embedded.value.file.parentFileName) {
						all.push({
							...embedded.value,
							file: {
								...embedded.value.file,
								parentFileName: embeddedVue.value.file.fileName,
							},
						});
					}
					else {
						all.push(embedded.value);
					}
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
		getCompiledVue: untrack(() => file2VueSourceMap.value),
		getSfcTemplateLanguageCompiled: untrack(() => computedHtmlTemplate.value),
		getSfcVueTemplateCompiled: untrack(() => templateAstCompiled.value),
		getScriptFileName: untrack(() => fileName.endsWith('.html') ? fileName + '.__VLS_script.' + scriptLang.value : fileName + '.' + scriptLang.value),
		getDescriptor: untrack(() => unref(sfc)),
		getScriptAst: untrack(() => scriptAst.value),
		getScriptSetupAst: untrack(() => scriptSetupAst.value),
		getSfcRefSugarRanges: untrack(() => sfcRefSugarRanges.value),
		getEmbeddeds: untrack(() => embeddeds.value),
		getScriptSetupRanges: untrack(() => scriptSetupRanges.value),
		isJsxMissing: () => !vueCompilerOptions.experimentalDisableTemplateSupport && (compilerOptions.jsx ?? ts.JsxEmit.Preserve) !== ts.JsxEmit.Preserve,

		getAllEmbeddeds: () => allEmbeddeds.value,
		getTeleports: () => teleports.value,
	};

	function embeddedRangeToVueRange(data: EmbeddedFileMappingData, range: Mapping<unknown>['sourceRange']) {

		if (vueContent.value === undefined) throw 'vueContent.value === undefined';

		if (data.vueTag === 'scriptSrc') {
			if (!sfc.script?.src) throw '!sfc.script?.src';
			const vueStart = vueContent.value.substring(0, sfc.script.startTagEnd).lastIndexOf(sfc.script.src);
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
	function vueRangeToEmbeddedRange(data: EmbeddedFileMappingData, range: Mapping<unknown>['sourceRange']) {

		if (vueContent.value === undefined) throw 'vueContent.value === undefined';

		if (data.vueTag === 'script') {
			if (!sfc.script) throw '!sfc.script';
			return {
				start: range.start - sfc.script.startTagEnd,
				end: range.end - sfc.script.startTagEnd,
			};
		}
		else if (data.vueTag === 'scriptSetup') {
			if (!sfc.scriptSetup) throw '!sfc.scriptSetup';
			return {
				start: range.start - sfc.scriptSetup.startTagEnd,
				end: range.end - sfc.scriptSetup.startTagEnd,
			};
		}
		else if (data.vueTag === 'template') {
			if (!sfc.template) throw '!sfc.template';
			return {
				start: range.start - sfc.template.startTagEnd,
				end: range.end - sfc.template.startTagEnd,
			};
		}
		else if (data.vueTag === 'style') {
			if (data.vueTagIndex === undefined) throw 'data.vueTagIndex === undefined';
			return {
				start: range.start - sfc.styles[data.vueTagIndex].startTagEnd,
				end: range.end - sfc.styles[data.vueTagIndex].startTagEnd,
			};
		}
		else if (data.vueTag === 'customBlock') {
			if (data.vueTagIndex === undefined) throw 'data.vueTagIndex === undefined';
			return {
				start: range.start - sfc.customBlocks[data.vueTagIndex].startTagEnd,
				end: range.end - sfc.customBlocks[data.vueTagIndex].startTagEnd,
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

function notEmpty<T>(value: T | null | undefined): value is T {
	return value !== null && value !== undefined;
}
