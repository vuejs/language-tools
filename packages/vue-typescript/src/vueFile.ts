import * as shared from '@volar/shared';
import { parseRefSugarCallRanges, parseRefSugarDeclarationRanges } from '@volar/vue-code-gen/out/parsers/refSugarRanges';
import { parseScriptRanges } from '@volar/vue-code-gen/out/parsers/scriptRanges';
import { parseScriptSetupRanges } from '@volar/vue-code-gen/out/parsers/scriptSetupRanges';
import { computed, reactive, ref, shallowReactive, unref } from '@vue/reactivity';
import { TextDocument } from 'vscode-languageserver-textdocument'; // TODO: use vue SFC parser instead of
import { ITemplateScriptData, VueCompilerOptions } from './types';
import { useSfcEntryForTemplateLs } from './use/useSfcEntryForTemplateLs';
import { useSfcCustomBlocks } from './use/useSfcCustomBlocks';
import { useSfcScript } from './use/useSfcScript';
import { useSfcScriptGen } from './use/useSfcScriptGen';
import { useSfcStyles } from './use/useSfcStyles';
import { useSfcTemplate } from './use/useSfcTemplate';
import { useSfcTemplateCompileResult } from './use/useSfcTemplateCompileResult';
import { useSfcTemplateScript } from './use/useSfcTemplateScript';
import { SearchTexts } from './utils/string';
import { untrack } from './utils/untrack';
import type * as html from 'vscode-html-languageservice'; // fix TS2742

import type * as _0 from 'typescript/lib/tsserverlibrary'; // fix TS2742
import type * as _2 from 'vscode-languageserver-types'; // fix TS2742
import { EmbeddedFileSourceMap } from '@volar/vue-typescript';
import type { TextRange } from '@volar/vue-code-gen';
import { VuePlugin } from './typescriptRuntime';
import { Teleport } from './utils/sourceMaps';

export interface VueFile extends ReturnType<typeof createVueFile> { }

export interface EmbeddedStructure {
	self: Embedded | undefined,
	embeddeds: EmbeddedStructure[]
}

export interface Embedded {
	file: EmbeddedFile,
	sourceMap: EmbeddedFileSourceMap,
}

export interface EmbeddedFile<T = unknown> {
	fileName: string,
	lang: string,
	content: string,
	lsType: 'template' | 'script' | 'nonTs',
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
	htmlLs: html.LanguageService,
	plugins: VuePlugin[],
	compilerOptions: VueCompilerOptions,
	ts: typeof import('typescript/lib/tsserverlibrary'),
	getCssVBindRanges: (cssEmbeddeFile: EmbeddedFile) => TextRange[],
	getCssClasses: (cssEmbeddeFile: EmbeddedFile) => Record<string, TextRange[]>,
) {

	// refs
	const content = ref('');
	const version = ref('');
	const sfc = reactive<shared.Sfc>({
		template: null,
		script: null,
		scriptSetup: null,
		styles: [],
		customBlocks: [],
	}) as shared.Sfc /* avoid Sfc unwrap in .d.ts by reactive */;
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

	// computeds
	const document = computed(() => TextDocument.create(shared.fsPathToUri(fileName), 'vue', 0, content.value));
	const vueHtmlDocument = computed(() => htmlLs.parseHTMLDocument(document.value));
	const parsedSfc = computed(() => shared.parseSfc(content.value, vueHtmlDocument.value));

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
				const compiledHtml = plugin.compileTemplate?.(sfc.template.content, sfc.template.lang);
				if (compiledHtml) {
					return {
						lang: sfc.template.lang,
						htmlText: compiledHtml.html,
						htmlToTemplate: compiledHtml.htmlToTemplate,
					};
				};
			}
		}
	});
	const sfcTemplateCompileResult = useSfcTemplateCompileResult(
		computed(() => sfcTemplateCompiled.value?.htmlText),
		compilerOptions,
	);
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
	const sfcEntryForTemplateLs = useSfcEntryForTemplateLs(
		fileName,
		computed(() => sfc.script),
		computed(() => sfc.scriptSetup),
		computed(() => sfc.template),
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
			self: sfcEntryForTemplateLs.embedded.value,
			embeddeds: [
				{
					self: sfcScriptForTemplateLs.embedded.value,
					embeddeds: [],
				},
				{
					self: sfcScriptForTemplateLs.embeddedTs.value,
					embeddeds: [],
				},
			],
		})

		// template
		embeddeds.push({
			self: sfcTemplate.embedded.value,
			embeddeds: [
				{
					self: sfcTemplateScript.embedded.value,
					embeddeds: [],
				},
				{
					self: sfcTemplateScript.formatEmbedded.value,
					embeddeds: [],
				},
				{
					self: sfcTemplateScript.inlineCssEmbedded.value,
					embeddeds: [],
				},
			],
		});

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
		getTextDocument: untrack(() => document.value),
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
			document,
			content,
			allEmbeddeds,
			teleports,
			sfcTemplateScript,
			sfcEntryForTemplateLs,
			sfcScriptForScriptLs,
			templateScriptData,
			templateLsTeleports: teleports,
		},
	};

	function update(newContent: string, newVersion: string) {

		const scriptLang_1 = sfcScriptForScriptLs.file.value.lang;
		const scriptText_1 = sfcScriptForScriptLs.file.value.content;
		const templateScriptContent = sfcTemplateScript.file.value?.content;

		content.value = newContent;
		version.value = newVersion;

		updateTemplate(parsedSfc.value['template']);
		updateScript(parsedSfc.value['script']);
		updateScriptSetup(parsedSfc.value['scriptSetup']);
		updateStyles(parsedSfc.value['styles']);
		updateCustomBlocks(parsedSfc.value['customBlocks']);

		sfcTemplateScript.update(); // TODO

		const scriptLang_2 = sfcScriptForScriptLs.file.value.lang;
		const scriptText_2 = sfcScriptForScriptLs.file.value.content;
		const templateScriptContent_2 = sfcTemplateScript.file.value?.content;

		return {
			scriptContentUpdated: lastUpdated.script || lastUpdated.scriptSetup,
			scriptUpdated: scriptLang_1 !== scriptLang_2 || scriptText_1 !== scriptText_2, // TODO
			templateScriptUpdated: templateScriptContent !== templateScriptContent_2,
		};

		function updateTemplate(newData: shared.Sfc['template']) {

			lastUpdated.template = sfc.template?.lang !== newData?.lang
				|| sfc.template?.content !== newData?.content;

			if (sfc.template && newData) {
				updateBlock(sfc.template, newData);
			}
			else {
				sfc.template = newData;
			}
		}
		function updateScript(newData: shared.Sfc['script']) {

			lastUpdated.script = sfc.script?.lang !== newData?.lang
				|| sfc.script?.content !== newData?.content;

			if (sfc.script && newData) {
				updateBlock(sfc.script, newData);
			}
			else {
				sfc.script = newData;
			}
		}
		function updateScriptSetup(newData: shared.Sfc['scriptSetup']) {

			lastUpdated.scriptSetup = sfc.scriptSetup?.lang !== newData?.lang
				|| sfc.scriptSetup?.content !== newData?.content;

			if (sfc.scriptSetup && newData) {
				updateBlock(sfc.scriptSetup, newData);
			}
			else {
				sfc.scriptSetup = newData;
			}
		}
		function updateStyles(newDataArr: shared.Sfc['styles']) {
			for (let i = 0; i < newDataArr.length; i++) {
				const newData = newDataArr[i];
				if (sfc.styles.length > i) {
					updateBlock(sfc.styles[i], newData);
				}
				else {
					sfc.styles.push(newData);
				}
			}
			while (sfc.styles.length > newDataArr.length) {
				sfc.styles.pop();
			}
		}
		function updateCustomBlocks(newDataArr: shared.Sfc['customBlocks']) {
			for (let i = 0; i < newDataArr.length; i++) {
				const newData = newDataArr[i];
				if (sfc.customBlocks.length > i) {
					updateBlock(sfc.customBlocks[i], newData);
				}
				else {
					sfc.customBlocks.push(newData);
				}
			}
			while (sfc.customBlocks.length > newDataArr.length) {
				sfc.customBlocks.pop();
			}
		}
		function updateBlock<T>(oldBlock: T, newBlock: T) {
			for (let key in newBlock) {
				oldBlock[key] = newBlock[key];
			}
		}
	}
	function updateTemplateScript(templateTsLs: ts.LanguageService, tempalteTsHost: ts.LanguageServiceHost) {
		const newVersion = tempalteTsHost.getProjectVersion?.();
		if (templateScriptData.projectVersion === newVersion) {
			return false;
		}
		templateScriptData.projectVersion = newVersion;

		const options: ts.GetCompletionsAtPositionOptions = {
			includeCompletionsWithInsertText: true, // if missing, { 'aaa-bbb': any, ccc: any } type only has result ['ccc']
		};

		const file = sfcEntryForTemplateLs.file.value;
		const context = file.content.indexOf(SearchTexts.Context) >= 0 ? templateTsLs.getCompletionsAtPosition(file.fileName, file.content.indexOf(SearchTexts.Context), options)?.entries ?? [] : [];
		let components = file.content.indexOf(SearchTexts.Components) >= 0 ? templateTsLs.getCompletionsAtPosition(file.fileName, file.content.indexOf(SearchTexts.Components), options)?.entries ?? [] : [];
		const props = file.content.indexOf(SearchTexts.Props) >= 0 ? templateTsLs.getCompletionsAtPosition(file.fileName, file.content.indexOf(SearchTexts.Props), options)?.entries ?? [] : [];
		const setupReturns = file.content.indexOf(SearchTexts.SetupReturns) >= 0 ? templateTsLs.getCompletionsAtPosition(file.fileName, file.content.indexOf(SearchTexts.SetupReturns), options)?.entries ?? [] : [];

		components = components.filter(entry => {
			return entry.name.indexOf('$') === -1 && !entry.name.startsWith('_');
		});

		const contextNames = context.map(entry => entry.name);
		const componentNames = components.map(entry => entry.name);
		const propNames = props.map(entry => entry.name);
		const setupReturnNames = setupReturns.map(entry => entry.name);

		let dirty = false;

		if (!shared.eqSet(new Set(contextNames), new Set(templateScriptData.context))) {
			templateScriptData.context = contextNames;
			templateScriptData.contextItems = context;
			dirty = true;
		}

		if (!shared.eqSet(new Set(componentNames), new Set(templateScriptData.components))) {
			templateScriptData.components = componentNames;
			templateScriptData.componentItems = components;
			dirty = true;
		}

		if (!shared.eqSet(new Set(propNames), new Set(templateScriptData.props))) {
			templateScriptData.props = propNames;
			dirty = true;
		}

		if (!shared.eqSet(new Set(setupReturnNames), new Set(templateScriptData.setupReturns))) {
			templateScriptData.setupReturns = setupReturnNames;
			dirty = true;
		}

		if (dirty) {
			sfcTemplateScript.update(); // TODO
		}

		return dirty;
	}
}
