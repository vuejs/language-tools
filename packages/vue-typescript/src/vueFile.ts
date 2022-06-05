import { compileSFCTemplate, EmbeddedFileMappingData } from '@volar/vue-code-gen';
import { parseRefSugarCallRanges, parseRefSugarDeclarationRanges } from '@volar/vue-code-gen/out/parsers/refSugarRanges';
import { parseScriptRanges } from '@volar/vue-code-gen/out/parsers/scriptRanges';
import { parseScriptSetupRanges } from '@volar/vue-code-gen/out/parsers/scriptSetupRanges';
import { parse, SFCBlock, SFCScriptBlock, SFCStyleBlock, SFCTemplateBlock } from '@vue/compiler-sfc';
import { computed, ComputedRef, reactive, ref, unref } from '@vue/reactivity';
import { ITemplateScriptData, VueCompilerOptions } from './types';
import { VueLanguagePlugin } from './typescriptRuntime';
import { useSfcScriptGen } from './use/useSfcScriptGen';
import { useSfcTemplateScript } from './use/useSfcTemplateScript';
import { EmbeddedFileSourceMap, Teleport } from './utils/sourceMaps';
import { SearchTexts } from './utils/string';
import { untrack } from './utils/untrack';

import type * as _0 from 'typescript/lib/tsserverlibrary'; // fix TS2742
import { Mapping } from '@volar/source-map';

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

export interface EmbeddedFile<T = unknown> {
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
	data: T,
};

export function createVueFile(
	fileName: string,
	_content: string,
	_version: string,
	plugins: VueLanguagePlugin[],
	compilerOptions: VueCompilerOptions,
	ts: typeof import('typescript/lib/tsserverlibrary'),
	tsLs: ts.LanguageService | undefined,
	tsHost: ts.LanguageServiceHost | undefined,
) {

	// refs
	const content = ref('');
	const version = ref('');
	const sfc = reactive<Sfc>({
		template: null,
		script: null,
		scriptSetup: null,
		styles: [],
		customBlocks: [],
	}) as Sfc /* avoid Sfc unwrap in .d.ts by reactive */;
	const lastUpdated = {
		template: false,
		script: false,
		scriptSetup: false,
	};
	let templateScriptData: ITemplateScriptData = {
		projectVersion: undefined,
		components: [],
		componentItems: [],
	};

	// computeds
	const parsedSfc = computed(() => parse(content.value, { sourceMap: false, ignoreEmpty: false }));
	const pluginEmbeddeds = plugins.map(plugin => {
		if (plugin.getEmbeddedFilesCount && plugin.getEmbeddedFile) {
			const embeddedsCount = computed(() => plugin.getEmbeddedFilesCount!(sfc));
			const embeddeds = computed(() => {
				const computeds: ComputedRef<Embedded>[] = [];
				for (let i = 0; i < embeddedsCount.value; i++) {
					const _i = i;
					const raw = computed(() => plugin.getEmbeddedFile!(fileName, sfc, _i));
					const transformed = computed(() => {
						const sourceMap = raw.value.sourceMap;
						const newMappings: typeof sourceMap.mappings = [];
						for (const mapping of sourceMap.mappings) {
							newMappings.push({
								...mapping,
								sourceRange: parseMappingSourceRange(mapping),
							});
						}
						const newSourceMap = new EmbeddedFileSourceMap(newMappings);
						const newEmbedded: Embedded = {
							file: raw.value.file,
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

	// use
	const sfcTemplateCompiled = computed<undefined | {
		lang: string,
		htmlText: string,
		htmlToTemplate: (start: number, end: number) => { start: number, end: number; } | undefined,
	}>(() => {
		if (sfc.template) {
			for (const plugin of plugins) {
				const compiledHtml = plugin.compileTemplate?.(sfc.template.content, sfc.template.lang);
				if (compiledHtml) {
					return {
						lang: sfc.template.lang,
						htmlText: compiledHtml.html,
						htmlToTemplate: compiledHtml.mapping,
					};
				};
			}
		}
	});
	const sfcTemplateCompileResult = computed(() => {
		if (sfcTemplateCompiled.value) {
			return compileSFCTemplate(
				sfcTemplateCompiled.value.htmlText,
				compilerOptions.experimentalTemplateCompilerOptions,
				compilerOptions.experimentalCompatMode ?? 3,
			);
		}
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
	const sfcTemplateScript = useSfcTemplateScript(
		ts,
		fileName,
		computed(() => sfc.template),
		computed(() => sfc.script),
		computed(() => sfc.scriptSetup),
		computed(() => scriptSetupRanges.value),
		computed(() => sfc.styles),
		sfcTemplateCompiled,
		sfcTemplateCompileResult,
		scriptLang,
		compilerOptions,
		!!compilerOptions.experimentalDisableTemplateSupport || !(tsHost?.getCompilationSettings().jsx === ts.JsxEmit.Preserve),
	);
	const sfcScriptForTemplateLs = useSfcScriptGen(
		'template',
		fileName,
		content,
		scriptLang,
		computed(() => sfc.script),
		computed(() => sfc.scriptSetup),
		computed(() => scriptRanges.value),
		computed(() => scriptSetupRanges.value),
		sfcTemplateScript.templateCodeGens,
		compilerOptions,
		sfcTemplateScript.cssVarTexts,
	);
	const sfcScriptForScriptLs = useSfcScriptGen(
		'script',
		fileName,
		content,
		scriptLang,
		computed(() => sfc.script),
		computed(() => sfc.scriptSetup),
		computed(() => scriptRanges.value),
		computed(() => scriptSetupRanges.value),
		sfcTemplateScript.templateCodeGens,
		compilerOptions,
		sfcTemplateScript.cssVarTexts,
	);
	const sfcRefSugarRanges = computed(() => (scriptSetupAst.value ? {
		refs: parseRefSugarDeclarationRanges(ts, scriptSetupAst.value, ['$ref', '$computed', '$shallowRef', '$fromRefs']),
		raws: parseRefSugarCallRanges(ts, scriptSetupAst.value, ['$raw', '$fromRefs']),
	} : undefined));

	// getters
	const teleports = computed(() => {

		const _all: {
			file: EmbeddedFile,
			teleport: Teleport,
		}[] = [];

		if (sfcScriptForTemplateLs.file.value && sfcScriptForTemplateLs.teleport.value) {
			_all.push({
				file: sfcScriptForTemplateLs.file.value,
				teleport: sfcScriptForTemplateLs.teleport.value,
			});
		}

		return _all;
	});
	const allEmbeddeds = computed(() => {

		const all: Embedded[] = [];

		for (const getEmbeddeds of pluginEmbeddeds) {
			for (const embedded of getEmbeddeds.value) {
				all.push(embedded.value);
			}
		}

		all.push(...[
			sfcTemplateScript.embedded.value,
			sfcTemplateScript.formatEmbedded.value,
			sfcTemplateScript.inlineCssEmbedded.value,
			sfcScriptForScriptLs.embedded.value,
			sfcScriptForTemplateLs.embedded.value,
		].filter(notEmpty));

		return all;
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
			console.error('remain embeddeds', remain.map(e => e.file.fileName));
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
		getContent: untrack(() => content.value),
		getSfcTemplateLanguageCompiled: untrack(() => sfcTemplateCompiled.value),
		getSfcVueTemplateCompiled: untrack(() => sfcTemplateCompileResult.value),
		getVersion: untrack(() => version.value),
		getTemplateTagNames: untrack(() => sfcTemplateScript.templateCodeGens.value?.tagNames),
		getTemplateAttrNames: untrack(() => sfcTemplateScript.templateCodeGens.value?.attrNames),
		update: untrack(update),
		getTemplateData: untrack(getTemplateData),
		getScriptFileName: untrack(() => fileName + '.' + scriptLang.value),
		getDescriptor: untrack(() => unref(sfc)),
		getScriptAst: untrack(() => scriptAst.value),
		getScriptSetupAst: untrack(() => scriptSetupAst.value),
		getTemplateFormattingScript: untrack(() => sfcTemplateScript.formatEmbedded.value),
		getSfcRefSugarRanges: untrack(() => sfcRefSugarRanges.value),
		getEmbeddeds: untrack(() => embeddeds.value),
		getAllEmbeddeds: untrack(() => allEmbeddeds.value),
		getLastUpdated: untrack(() => unref(lastUpdated)),
		getScriptSetupRanges: untrack(() => scriptSetupRanges.value),
		isJsxMissing: () => !compilerOptions.experimentalDisableTemplateSupport && !(tsHost?.getCompilationSettings().jsx === ts.JsxEmit.Preserve),

		refs: {
			content,
			allEmbeddeds,
			teleports,
			sfcTemplateScript,
		},
	};

	function parseMappingSourceRange({ data, sourceRange: range }: Mapping<EmbeddedFileMappingData>) {
		if (data.vueTag === 'scriptSrc' && sfc.script?.src) {
			const vueStart = content.value.substring(0, sfc.script.startTagEnd).lastIndexOf(sfc.script.src);
			const vueEnd = vueStart + sfc.script.src.length;
			return {
				start: vueStart - 1,
				end: vueEnd + 1,
			};
		}
		else if (data.vueTag === 'script' && sfc.script) {
			return {
				start: sfc.script.startTagEnd + range.start,
				end: sfc.script.startTagEnd + range.end,
			};
		}
		else if (data.vueTag === 'scriptSetup' && sfc.scriptSetup) {
			return {
				start: sfc.scriptSetup.startTagEnd + range.start,
				end: sfc.scriptSetup.startTagEnd + range.end,
			};
		}
		else if (data.vueTag === 'template' && sfc.template) {
			return {
				start: sfc.template.startTagEnd + range.start,
				end: sfc.template.startTagEnd + range.end,
			};
		}
		else if (data.vueTag === 'style' && data?.vueTagIndex !== undefined) {
			return {
				start: sfc.styles[data.vueTagIndex].startTagEnd + range.start,
				end: sfc.styles[data.vueTagIndex].startTagEnd + range.end,
			};
		}
		else if (data.vueTag === 'customBlock' && data?.vueTagIndex !== undefined) {
			return {
				start: sfc.customBlocks[data.vueTagIndex].startTagEnd + range.start,
				end: sfc.customBlocks[data.vueTagIndex].startTagEnd + range.end,
			};
		}
		return range;
	}
	function update(newContent: string, newVersion: string) {

		const scriptLang_1 = sfcScriptForScriptLs.file.value.lang;
		const scriptText_1 = sfcScriptForScriptLs.file.value.content;
		const templateScriptContent = sfcTemplateScript.file.value?.content;

		content.value = newContent;
		version.value = newVersion;

		updateTemplate(parsedSfc.value.descriptor.template);
		updateScript(parsedSfc.value.descriptor.script);
		updateScriptSetup(parsedSfc.value.descriptor.scriptSetup);
		updateStyles(parsedSfc.value.descriptor.styles);
		updateCustomBlocks(parsedSfc.value.descriptor.customBlocks);

		const scriptLang_2 = sfcScriptForScriptLs.file.value.lang;
		const scriptText_2 = sfcScriptForScriptLs.file.value.content;
		const templateScriptContent_2 = sfcTemplateScript.file.value?.content;

		return {
			scriptUpdated: scriptLang_1 !== scriptLang_2 || scriptText_1 !== scriptText_2 || templateScriptContent !== templateScriptContent_2, // TODO
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

			lastUpdated.template = sfc.template?.lang !== newData?.lang
				|| sfc.template?.content !== newData?.content;

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

			lastUpdated.script = sfc.script?.lang !== newData?.lang
				|| sfc.script?.content !== newData?.content;

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

			lastUpdated.scriptSetup = sfc.scriptSetup?.lang !== newData?.lang
				|| sfc.scriptSetup?.content !== newData?.content;

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

		const file = sfcTemplateScript.file.value;
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
