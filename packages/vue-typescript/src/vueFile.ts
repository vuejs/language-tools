import { compileSFCTemplate, TextRange } from '@volar/vue-code-gen';
import { parseRefSugarCallRanges, parseRefSugarDeclarationRanges } from '@volar/vue-code-gen/out/parsers/refSugarRanges';
import { parseScriptRanges } from '@volar/vue-code-gen/out/parsers/scriptRanges';
import { parseScriptSetupRanges } from '@volar/vue-code-gen/out/parsers/scriptSetupRanges';
import { EmbeddedFileSourceMap } from '@volar/vue-typescript';
import { parse, SFCBlock, SFCScriptBlock, SFCStyleBlock, SFCTemplateBlock } from '@vue/compiler-sfc';
import { computed, reactive, ref, shallowReactive, unref } from '@vue/reactivity';
import { ITemplateScriptData, VueCompilerOptions } from './types';
import { VueLanguagePlugin } from './typescriptRuntime';
import { useSfcCustomBlocks } from './use/useSfcCustomBlocks';
import { useSfcEntryForTemplateLs } from './use/useSfcEntryForTemplateLs';
import { useSfcScript } from './use/useSfcScript';
import { useSfcScriptGen } from './use/useSfcScriptGen';
import { useSfcStyles } from './use/useSfcStyles';
import { useSfcTemplate } from './use/useSfcTemplate';
import { useSfcTemplateScript } from './use/useSfcTemplateScript';
import { Teleport } from './utils/sourceMaps';
import { SearchTexts } from './utils/string';
import { untrack } from './utils/untrack';
import { parseCssVars } from './utils/parseCssVars';

import type * as _0 from 'typescript/lib/tsserverlibrary'; // fix TS2742

export interface VueFile extends ReturnType<typeof createVueFile> { }

export interface EmbeddedStructure {
	self: Embedded | undefined,
	embeddeds: EmbeddedStructure[],
	inheritParentIndent?: boolean,
}

export interface Embedded {
	file: EmbeddedFile,
	sourceMap: EmbeddedFileSourceMap,
}

export interface SfcBlock {
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
	capabilities: {
		diagnostics: boolean,
		foldingRanges: boolean,
		formatting: boolean,
		documentSymbol: boolean,
		codeActions: boolean,
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
	baseCssModuleType: string,
	getCssClasses: (cssEmbeddeFile: EmbeddedFile) => Record<string, TextRange[]>,
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
	const templateScriptData = shallowReactive<ITemplateScriptData>({
		projectVersion: undefined,
		context: [],
		contextItems: [],
		components: [],
		componentItems: [],
		props: [],
		setupReturns: [],
	}) as ITemplateScriptData;
	const cssVars = new WeakMap<EmbeddedFile, TextRange[]>();

	// computeds
	const parsedSfc = computed(() => parse(content.value, { sourceMap: false, ignoreEmpty: false }));

	// use
	const sfcStyles = useSfcStyles(fileName, computed(() => sfc.styles));
	const sfcCustomBlocks = useSfcCustomBlocks(fileName, computed(() => sfc.customBlocks));
	const sfcTemplate = useSfcTemplate(fileName, computed(() => sfc.template));
	const sfcTemplateCompiled = computed<undefined | {
		lang: string,
		htmlText: string,
		htmlToTemplate: (start: number, end: number) => { start: number, end: number } | undefined,
	}>(() => {
		if (sfc.template) {
			for (const plugin of plugins) {
				const compiledHtml = plugin.compileTemplate?.(sfc.template.content, sfc.template.lang ?? 'html');
				if (compiledHtml) {
					return {
						lang: sfc.template.lang ?? 'html',
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
	const sfcScript = useSfcScript(
		fileName,
		computed(() => sfc.script),
		ts,
	);
	const sfcScriptSetup = useSfcScript(
		fileName,
		computed(() => sfc.scriptSetup),
		ts,
	);
	const scriptRanges = computed(() =>
		sfcScript.ast.value
			? parseScriptRanges(ts, sfcScript.ast.value, !!sfc.scriptSetup, false, false)
			: undefined
	);
	const scriptSetupRanges = computed(() =>
		sfcScriptSetup.ast.value
			? parseScriptSetupRanges(ts, sfcScriptSetup.ast.value)
			: undefined
	);
	const sfcScriptForTemplateLs = useSfcScriptGen(
		'template',
		fileName,
		content,
		computed(() => sfc.script),
		computed(() => sfc.scriptSetup),
		computed(() => scriptRanges.value),
		computed(() => scriptSetupRanges.value),
		sfcTemplateCompileResult,
		computed(() => sfcStyles.files.value),
		compilerOptions.experimentalCompatMode === 2,
		getCssVBindRanges,
	);
	const sfcScriptForScriptLs = useSfcScriptGen(
		'script',
		fileName,
		content,
		computed(() => sfc.script),
		computed(() => sfc.scriptSetup),
		computed(() => scriptRanges.value),
		computed(() => scriptSetupRanges.value),
		sfcTemplateCompileResult,
		computed(() => sfcStyles.files.value),
		compilerOptions.experimentalCompatMode === 2,
		getCssVBindRanges,
	);
	const sfcTemplateMiddleScript = useSfcEntryForTemplateLs(
		fileName,
		computed(() => sfc.script),
		computed(() => sfc.scriptSetup),
		computed(() => !!sfcScriptForTemplateLs.fileTs.value),
		compilerOptions.experimentalCompatMode === 2,
	);
	const sfcTemplateScript = useSfcTemplateScript(
		fileName,
		computed(() => sfc.template),
		computed(() => sfc.scriptSetup),
		computed(() => scriptSetupRanges.value),
		computed(() => sfc.styles),
		templateScriptData,
		sfcStyles.files,
		sfcStyles.embeddeds,
		sfcTemplateCompiled,
		sfcTemplateCompileResult,
		sfcStyles.files,
		sfcScriptForScriptLs.lang,
		compilerOptions,
		baseCssModuleType,
		getCssVBindRanges,
		getCssClasses,
	);
	const sfcRefSugarRanges = computed(() => (sfcScriptSetup.ast.value ? {
		refs: parseRefSugarDeclarationRanges(ts, sfcScriptSetup.ast.value, ['$ref', '$computed', '$shallowRef', '$fromRefs']),
		raws: parseRefSugarCallRanges(ts, sfcScriptSetup.ast.value, ['$raw', '$fromRefs']),
	} : undefined));

	// getters
	const teleports = computed(() => {

		const _all: {
			file: EmbeddedFile,
			teleport: Teleport,
		}[] = [];

		if (sfcTemplateScript.file.value && sfcTemplateScript.teleport.value) {
			_all.push({
				file: sfcTemplateScript.file.value,
				teleport: sfcTemplateScript.teleport.value,
			});
		}

		if (sfcScriptForTemplateLs.file.value && sfcScriptForTemplateLs.teleport.value) {
			_all.push({
				file: sfcScriptForTemplateLs.file.value,
				teleport: sfcScriptForTemplateLs.teleport.value,
			});
		}

		return _all;
	});
	const embeddeds = computed(() => {

		const embeddeds: EmbeddedStructure[] = [];

		// template
		embeddeds.push({
			self: sfcTemplate.embedded.value,
			embeddeds: [
				{
					self: sfcTemplateScript.embedded.value,
					inheritParentIndent: true,
					embeddeds: [],
				},
				{
					self: sfcTemplateScript.formatEmbedded.value,
					inheritParentIndent: true,
					embeddeds: [],
				},
				{
					self: sfcTemplateScript.inlineCssEmbedded.value,
					inheritParentIndent: true,
					embeddeds: [],
				},
			],
		});

		// scripts - format
		embeddeds.push({
			self: sfcScript.embedded.value,
			embeddeds: [],
		});
		embeddeds.push({
			self: sfcScriptSetup.embedded.value,
			embeddeds: [],
		});

		// scripts - script ls
		embeddeds.push({
			self: sfcScriptForScriptLs.embedded.value,
			embeddeds: [],
		});

		// scripts - template ls
		embeddeds.push({
			self: sfcTemplateMiddleScript.embedded.value,
			embeddeds: [],
		});
		embeddeds.push({
			self: sfcScriptForTemplateLs.embedded.value,
			embeddeds: [],
		});
		embeddeds.push({
			self: sfcScriptForTemplateLs.embeddedTs.value,
			embeddeds: [],
		});

		// styles
		for (const style of sfcStyles.embeddeds.value) {
			embeddeds.push({
				self: style,
				embeddeds: [],
			});
		}

		// customBlocks
		for (const customBlock of sfcCustomBlocks.embeddeds.value) {
			embeddeds.push({
				self: customBlock,
				embeddeds: [],
			});
		}

		return embeddeds;
	});
	const allEmbeddeds = computed(() => {

		const all: Embedded[] = [];

		visitEmbedded(embeddeds.value, embedded => all.push(embedded));

		return all;

		function visitEmbedded(embeddeds: EmbeddedStructure[], cb: (embedded: Embedded) => void) {
			for (const embedded of embeddeds) {

				visitEmbedded(embedded.embeddeds, cb);

				if (embedded.self) {
					cb(embedded.self);
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
		updateTemplateScript: untrack(updateTemplateScript),
		getScriptTsFile: untrack(() => sfcScriptForScriptLs.file.value),
		getEmbeddedTemplate: untrack(() => sfcTemplate.embedded.value),
		getTemplateScriptData: untrack(() => templateScriptData),
		getDescriptor: untrack(() => unref(sfc)),
		getScriptAst: untrack(() => sfcScript.ast.value),
		getScriptSetupAst: untrack(() => sfcScriptSetup.ast.value),
		getTemplateFormattingScript: untrack(() => sfcTemplateScript.formatEmbedded.value),
		getSfcRefSugarRanges: untrack(() => sfcRefSugarRanges.value),
		getEmbeddeds: untrack(() => embeddeds.value),
		getAllEmbeddeds: untrack(() => allEmbeddeds.value),
		getLastUpdated: untrack(() => unref(lastUpdated)),
		getScriptSetupRanges: untrack(() => scriptSetupRanges.value),
		getSfcTemplateDocument: untrack(() => sfcTemplate.file.value),

		refs: {
			content,
			allEmbeddeds,
			teleports,
			sfcTemplateScript,
			sfcEntryForTemplateLs: sfcTemplateMiddleScript,
			sfcScriptForScriptLs,
			templateScriptData,
		},
	};

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

		sfcTemplateScript.update(); // TODO

		const scriptLang_2 = sfcScriptForScriptLs.file.value.lang;
		const scriptText_2 = sfcScriptForScriptLs.file.value.content;
		const templateScriptContent_2 = sfcTemplateScript.file.value?.content;

		return {
			scriptContentUpdated: lastUpdated.script || lastUpdated.scriptSetup,
			scriptUpdated: scriptLang_1 !== scriptLang_2 || scriptText_1 !== scriptText_2, // TODO
			templateScriptUpdated: templateScriptContent !== templateScriptContent_2,
		};

		function updateTemplate(block: SFCTemplateBlock | null) {

			const newData: Sfc['template'] | null = block ? {
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
	function updateTemplateScript(tsLs: ts.LanguageService, tsHost: ts.LanguageServiceHost) {
		const newVersion = tsHost.getProjectVersion?.();
		if (templateScriptData.projectVersion === newVersion) {
			return false;
		}
		templateScriptData.projectVersion = newVersion;

		const options: ts.GetCompletionsAtPositionOptions = {
			includeCompletionsWithInsertText: true, // if missing, { 'aaa-bbb': any, ccc: any } type only has result ['ccc']
		};

		const file = sfcTemplateMiddleScript.file.value;
		const context = file.content.indexOf(SearchTexts.Context) >= 0 ? tsLs.getCompletionsAtPosition(file.fileName, file.content.indexOf(SearchTexts.Context), options)?.entries ?? [] : [];
		let components = file.content.indexOf(SearchTexts.Components) >= 0 ? tsLs.getCompletionsAtPosition(file.fileName, file.content.indexOf(SearchTexts.Components), options)?.entries ?? [] : [];
		const props = file.content.indexOf(SearchTexts.Props) >= 0 ? tsLs.getCompletionsAtPosition(file.fileName, file.content.indexOf(SearchTexts.Props), options)?.entries ?? [] : [];
		const setupReturns = file.content.indexOf(SearchTexts.SetupReturns) >= 0 ? tsLs.getCompletionsAtPosition(file.fileName, file.content.indexOf(SearchTexts.SetupReturns), options)?.entries ?? [] : [];

		components = components.filter(entry => {
			return entry.name.indexOf('$') === -1 && !entry.name.startsWith('_');
		});

		const contextNames = context.map(entry => entry.name);
		const componentNames = components.map(entry => entry.name);
		const propNames = props.map(entry => entry.name);
		const setupReturnNames = setupReturns.map(entry => entry.name);

		let dirty = false;

		if (!eqSet(new Set(contextNames), new Set(templateScriptData.context))) {
			templateScriptData.context = contextNames;
			templateScriptData.contextItems = context;
			dirty = true;
		}

		if (!eqSet(new Set(componentNames), new Set(templateScriptData.components))) {
			templateScriptData.components = componentNames;
			templateScriptData.componentItems = components;
			dirty = true;
		}

		if (!eqSet(new Set(propNames), new Set(templateScriptData.props))) {
			templateScriptData.props = propNames;
			dirty = true;
		}

		if (!eqSet(new Set(setupReturnNames), new Set(templateScriptData.setupReturns))) {
			templateScriptData.setupReturns = setupReturnNames;
			dirty = true;
		}

		if (dirty) {
			sfcTemplateScript.update(); // TODO
		}

		return dirty;
	}
	function getCssVBindRanges(embeddedFile: EmbeddedFile) {

		let binds = cssVars.get(embeddedFile);

		if (!binds) {
			binds = [...parseCssVars(embeddedFile.content)];
			cssVars.set(embeddedFile, binds)
		}

		return binds;
	}
}

function eqSet<T>(as: Set<T>, bs: Set<T>) {
	if (as.size !== bs.size) return false;
	for (const a of as) if (!bs.has(a)) return false;
	return true;
}

const validScriptSyntaxs = ['js', 'jsx', 'ts', 'tsx'] as const;

type ValidScriptSyntax = typeof validScriptSyntaxs[number];

function getValidScriptSyntax(syntax: string): ValidScriptSyntax {
	if (validScriptSyntaxs.includes(syntax as ValidScriptSyntax)) {
		return syntax as ValidScriptSyntax;
	}
	return 'js';
}
