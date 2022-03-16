import * as shared from '@volar/shared';
import { parseRefSugarCallRanges, parseRefSugarDeclarationRanges } from '@volar/vue-code-gen/out/parsers/refSugarRanges';
import { parseScriptRanges } from '@volar/vue-code-gen/out/parsers/scriptRanges';
import { parseScriptSetupRanges } from '@volar/vue-code-gen/out/parsers/scriptSetupRanges';
import { computed, reactive, ref, shallowReactive, unref } from '@vue/reactivity';
import { TextDocument } from 'vscode-languageserver-textdocument';
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
import { EmbeddedDocumentSourceMap } from '@volar/vue-typescript';
import type { TextRange } from '@volar/vue-code-gen';

export interface VueDocument extends ReturnType<typeof createVueDocument> { }

export type Embedded = {
	sourceMap: EmbeddedDocumentSourceMap | undefined,
	embeddeds: Embedded[]
};

export function createVueDocument(
	uri: string,
	_content: string,
	_version: string,
	htmlLs: html.LanguageService,
	compileTemplate: (template: string, lang: string) => {
		htmlText: string,
		htmlToTemplate: (start: number, end: number) => { start: number, end: number } | undefined,
	} | undefined,
	compilerOptions: VueCompilerOptions,
	ts: typeof import('typescript/lib/tsserverlibrary'),
    getCssVBindRanges: (documrnt: TextDocument) => TextRange[],
    getCssClasses: (documrnt: TextDocument) => Record<string, TextRange[]>,
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
	const document = computed(() => TextDocument.create(uri, 'vue', 0, content.value));
	const vueHtmlDocument = computed(() => htmlLs.parseHTMLDocument(document.value));
	const parsedSfc = computed(() => shared.parseSfc(content.value, vueHtmlDocument.value));

	// use
	const sfcStyles = useSfcStyles(uri, document, computed(() => sfc.styles));
	const sfcCustomBlocks = useSfcCustomBlocks(uri, document, computed(() => sfc.customBlocks));
	const sfcTemplate = useSfcTemplate(uri, document, computed(() => sfc.template));
	const sfcTemplateCompiled = computed<undefined | {
		lang: string,
		htmlText: string,
		htmlToTemplate: (start: number, end: number) => { start: number, end: number } | undefined,
	}>(() => {
		if (sfc.template) {
			const compiledHtml = compileTemplate(sfc.template.content, sfc.template.lang);
			if (compiledHtml) {
				return {
					lang: sfc.template.lang,
					htmlText: compiledHtml.htmlText,
					htmlToTemplate: compiledHtml.htmlToTemplate,
				};
			};
		}
	});
	const sfcTemplateCompileResult = useSfcTemplateCompileResult(
		computed(() => sfcTemplateCompiled.value?.htmlText),
		compilerOptions,
	);
	const sfcScript = useSfcScript(
		uri,
		document,
		computed(() => sfc.script),
		ts,
	);
	const sfcScriptSetup = useSfcScript(
		uri,
		document,
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
		uri,
		document,
		computed(() => sfc.script),
		computed(() => sfc.scriptSetup),
		computed(() => scriptRanges.value),
		computed(() => scriptSetupRanges.value),
		sfcTemplateCompileResult,
		computed(() => sfcStyles.textDocuments.value),
		compilerOptions.experimentalCompatMode === 2,
		getCssVBindRanges,
	);
	const sfcScriptForScriptLs = useSfcScriptGen(
		'script',
		uri,
		document,
		computed(() => sfc.script),
		computed(() => sfc.scriptSetup),
		computed(() => scriptRanges.value),
		computed(() => scriptSetupRanges.value),
		sfcTemplateCompileResult,
		computed(() => sfcStyles.textDocuments.value),
		compilerOptions.experimentalCompatMode === 2,
		getCssVBindRanges,
	);
	const sfcEntryForTemplateLs = useSfcEntryForTemplateLs(
		uri,
		document,
		computed(() => sfc.script),
		computed(() => sfc.scriptSetup),
		computed(() => sfc.template),
		computed(() => !!sfcScriptForTemplateLs.textDocumentTs.value),
		compilerOptions.experimentalCompatMode === 2,
	);
	const sfcTemplateScript = useSfcTemplateScript(
		uri,
		document,
		computed(() => sfc.template),
		computed(() => sfc.scriptSetup),
		computed(() => scriptSetupRanges.value),
		computed(() => sfc.styles),
		templateScriptData,
		sfcStyles.textDocuments,
		sfcStyles.sourceMaps,
		sfcTemplateCompiled,
		sfcTemplateCompileResult,
		computed(() => sfcStyles.textDocuments.value),
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
	const templateLsTeleports = computed(() => [
		sfcTemplateScript.teleportSourceMap.value,
		sfcScriptForTemplateLs.teleportSourceMap.value,
	].filter(shared.notEmpty));

	const embeddeds = computed(() => {

		const embeddeds: Embedded[] = [];

		// styles
		for (const style of sfcStyles.sourceMaps.value) {
			embeddeds.push({
				sourceMap: style,
				embeddeds: [],
			});
		}

		// customBlocks
		for (const customBlock of sfcCustomBlocks.sourceMaps.value) {
			embeddeds.push({
				sourceMap: customBlock,
				embeddeds: [],
			});
		}

		// scripts - format
		embeddeds.push({
			sourceMap: sfcScript.sourceMap.value,
			embeddeds: [],
		});
		embeddeds.push({
			sourceMap: sfcScriptSetup.sourceMap.value,
			embeddeds: [],
		});

		// scripts - script ls
		embeddeds.push({
			sourceMap: sfcScriptForScriptLs.sourceMap.value,
			embeddeds: [],
		});

		// scripts - template ls
		embeddeds.push({
			sourceMap: sfcEntryForTemplateLs.sourceMap.value,
			embeddeds: [
				{
					sourceMap: sfcScriptForTemplateLs.sourceMap.value,
					embeddeds: [],
				},
				{
					sourceMap: sfcScriptForTemplateLs.sourceMapTs.value,
					embeddeds: [],
				},
			],
		})

		// template
		embeddeds.push({
			sourceMap: sfcTemplate.sourceMap.value,
			embeddeds: [
				{
					sourceMap: sfcTemplateScript.sourceMap.value,
					embeddeds: [],
				},
				{
					sourceMap: sfcTemplateScript.sourceMapForFormatting.value,
					embeddeds: [],
				},
				{
					sourceMap: sfcTemplateScript.cssSourceMap.value,
					embeddeds: [],
				},
			],
		});

		return embeddeds;
	});
	const sourceMaps = computed(() => {

		const _sourceMaps: EmbeddedDocumentSourceMap[] = [];

		visitEmbedded(embeddeds.value, sourceMap => _sourceMaps.push(sourceMap));

		function visitEmbedded(embeddeds: Embedded[], cb: (sourceMap: EmbeddedDocumentSourceMap) => void) {
			for (const embedded of embeddeds) {

				visitEmbedded(embedded.embeddeds, cb);

				if (embedded.sourceMap) {
					cb(embedded.sourceMap);
				}
			}
		}

		return _sourceMaps;
	});

	update(_content, _version);

	return {
		uri,
		getSfcTemplateLanguageCompiled: untrack(() => sfcTemplateCompiled.value),
		getSfcVueTemplateCompiled: untrack(() => sfcTemplateCompileResult.value),
		getVersion: untrack(() => version.value),
		getTemplateTagNames: untrack(() => sfcTemplateScript.templateCodeGens.value?.tagNames),
		getTemplateAttrNames: untrack(() => sfcTemplateScript.templateCodeGens.value?.attrNames),
		getTextDocument: untrack(() => document.value),
		update: untrack(update),
		updateTemplateScript: untrack(updateTemplateScript),
		getScriptTsDocument: untrack(() => sfcScriptForScriptLs.textDocument.value),
		getTemplateSourceMaps: untrack(() => sfcTemplate.sourceMap.value ? [sfcTemplate.sourceMap.value] : []),
		getTemplateScriptData: untrack(() => templateScriptData),
		getDescriptor: untrack(() => sfc), // TODO: untrack not working for reactive
		getScriptAst: untrack(() => sfcScript.ast.value),
		getScriptSetupAst: untrack(() => sfcScriptSetup.ast.value),
		getTemplateFormattingScript: untrack(() => ({
			document: sfcTemplateScript.textDocumentForFormatting.value,
			sourceMap: sfcTemplateScript.sourceMapForFormatting.value,
		})),
		getSfcRefSugarRanges: untrack(() => sfcRefSugarRanges.value),
		getEmbeddeds: untrack(() => embeddeds.value),
		getSourceMaps: untrack(() => sourceMaps.value),
		getLastUpdated: untrack(() => unref(lastUpdated)),
		getScriptSetupRanges: untrack(() => scriptSetupRanges.value),
		getSfcTemplateDocument: untrack(() => sfcTemplate.textDocument.value),

		refs: {
			sourceMaps,
			sfcTemplateScript,
			sfcEntryForTemplateLs,
			sfcScriptForScriptLs,
			templateScriptData,
			templateLsTeleports,
		},
	};

	function update(newContent: string, newVersion: string) {

		const scriptLang_1 = sfcScriptForScriptLs.textDocument.value.languageId;
		const scriptText_1 = sfcScriptForScriptLs.textDocument.value.getText();
		const templateScriptVersion_1 = sfcTemplateScript.textDocument.value?.version;

		content.value = newContent;
		version.value = newVersion;

		updateTemplate(parsedSfc.value['template']);
		updateScript(parsedSfc.value['script']);
		updateScriptSetup(parsedSfc.value['scriptSetup']);
		updateStyles(parsedSfc.value['styles']);
		updateCustomBlocks(parsedSfc.value['customBlocks']);

		sfcTemplateScript.update(); // TODO

		const scriptLang_2 = sfcScriptForScriptLs.textDocument.value.languageId;
		const scriptText_2 = sfcScriptForScriptLs.textDocument.value.getText();
		const templateScriptVersion_2 = sfcTemplateScript.textDocument.value?.version;

		return {
			scriptContentUpdated: lastUpdated.script || lastUpdated.scriptSetup,
			scriptUpdated: scriptLang_1 !== scriptLang_2 || scriptText_1 !== scriptText_2, // TODO
			templateScriptUpdated: templateScriptVersion_1 !== templateScriptVersion_2,
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

		const doc = sfcEntryForTemplateLs.textDocument.value;
		const docText = doc.getText();
		const docFileName = shared.uriToFsPath(doc.uri);
		const context = docText.indexOf(SearchTexts.Context) >= 0 ? templateTsLs.getCompletionsAtPosition(docFileName, docText.indexOf(SearchTexts.Context), options)?.entries ?? [] : [];
		let components = docText.indexOf(SearchTexts.Components) >= 0 ? templateTsLs.getCompletionsAtPosition(docFileName, docText.indexOf(SearchTexts.Components), options)?.entries ?? [] : [];
		const props = docText.indexOf(SearchTexts.Props) >= 0 ? templateTsLs.getCompletionsAtPosition(docFileName, docText.indexOf(SearchTexts.Props), options)?.entries ?? [] : [];
		const setupReturns = docText.indexOf(SearchTexts.SetupReturns) >= 0 ? templateTsLs.getCompletionsAtPosition(docFileName, docText.indexOf(SearchTexts.SetupReturns), options)?.entries ?? [] : [];

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
