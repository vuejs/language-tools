import * as shared from '@volar/shared';
import { parseRefSugarCallRanges, parseRefSugarDeclarationRanges } from '@volar/vue-code-gen/out/parsers/refSugarRanges';
import { parseScriptRanges } from '@volar/vue-code-gen/out/parsers/scriptRanges';
import { parseScriptSetupRanges } from '@volar/vue-code-gen/out/parsers/scriptSetupRanges';
import { computed, reactive, ref, shallowReactive } from '@vue/reactivity';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type * as ts2 from 'vscode-typescript-languageservice';
import type { Data as TsCompletionData } from 'vscode-typescript-languageservice/src/services/completion';
import { BasicRuntimeContext, ITemplateScriptData, VueCompilerOptions } from './types';
import { useSfcEntryForTemplateLs } from './use/useSfcEntryForTemplateLs';
import { useSfcJsons } from './use/useSfcJsons';
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

export interface SourceFile extends ReturnType<typeof createSourceFile> { }

export function createSourceFile(
	uri: string,
	_content: string,
	_version: string,
	htmlLs: html.LanguageService,
	compileTemplate: (document: TextDocument) => {
		htmlTextDocument: TextDocument,
		htmlToTemplate: (start: number, end: number) => number | undefined,
	} | undefined,
	compilerOptions: VueCompilerOptions,
	ts: typeof import('typescript/lib/tsserverlibrary'),
	getCssVBindRanges: BasicRuntimeContext['getCssVBindRanges'],
	getCssClasses: BasicRuntimeContext['getCssClasses'],
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
	});

	// computeds
	const document = computed(() => TextDocument.create(uri, 'vue', 0, content.value));
	const vueHtmlDocument = computed(() => htmlLs.parseHTMLDocument(document.value));

	// use
	const sfcStyles = useSfcStyles(uri, document, computed(() => sfc.styles));
	const sfcJsons = useSfcJsons(uri, document, computed(() => sfc.customBlocks));
	const sfcTemplate = useSfcTemplate(uri, document, computed(() => sfc.template));
	const sfcTemplateData = computed<undefined | {
		lang: string,
		htmlTextDocument: TextDocument,
		htmlToTemplate: (start: number, end: number) => number | undefined,
	}>(() => {
		if (sfc.template && sfcTemplate.textDocument.value) {
			const compiledHtml = compileTemplate(sfcTemplate.textDocument.value);
			if (compiledHtml) {
				return {
					lang: sfc.template.lang,
					htmlTextDocument: compiledHtml.htmlTextDocument,
					htmlToTemplate: compiledHtml.htmlToTemplate,
				};
			};
		}
	});
	const sfcTemplateCompileResult = useSfcTemplateCompileResult(
		computed(() => sfcTemplateData.value?.htmlTextDocument),
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
		sfcTemplateData,
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
	const cssLsDocuments = computed(() => [
		sfcTemplateScript.cssTextDocument.value,
		...sfcStyles.textDocuments.value,
	].filter(shared.notEmpty));
	const cssLsSourceMaps = computed(() => [
		sfcTemplateScript.cssSourceMap.value,
		...sfcStyles.sourceMaps.value,
	].filter(shared.notEmpty));
	const templateLsSourceMaps = computed(() => [
		sfcScriptForTemplateLs.sourceMap.value,
		sfcTemplateScript.sourceMap.value,
		sfcEntryForTemplateLs.sourceMap.value,
	].filter(shared.notEmpty));
	const scriptLsSourceMaps = computed(() => [
		sfcScriptForScriptLs.sourceMap.value,
	].filter(shared.notEmpty));
	const templateLsDocuments = computed(() => [
		sfcEntryForTemplateLs.textDocument.value,
		sfcScriptForTemplateLs.textDocument.value,
		sfcScriptForTemplateLs.textDocumentTs.value,
		sfcTemplateScript.textDocument.value,
	].filter(shared.notEmpty));
	const scriptLsDocuments = computed(() => [
		sfcScriptForScriptLs.textDocument.value,
	].filter(shared.notEmpty));
	const tsSourceMaps = computed(() => [
		sfcScriptForScriptLs.sourceMap.value,
		...templateLsSourceMaps.value,
	]);
	const templateLsTeleports = computed(() => [
		sfcTemplateScript.teleportSourceMap.value,
		sfcScriptForTemplateLs.teleportSourceMap.value,
	].filter(shared.notEmpty));

	update(_content, _version);

	return {
		uri,
		getVersion: untrack(() => version.value),
		getTemplateTagNames: untrack(() => sfcTemplateScript.templateCodeGens.value?.tagNames),
		getTemplateAttrNames: untrack(() => sfcTemplateScript.templateCodeGens.value?.attrNames),
		getTextDocument: untrack(() => document.value),
		getTemplateScriptDocument: untrack(() => sfcTemplateScript.textDocument.value),
		update: untrack(update),
		updateTemplateScript: untrack(updateTemplateScript),
		getScriptTsDocument: untrack(() => sfcScriptForScriptLs.textDocument.value),
		getScriptTsSourceMap: untrack(() => sfcScriptForScriptLs.sourceMap.value),
		getTsSourceMaps: untrack(() => tsSourceMaps.value),
		getCssSourceMaps: untrack(() => cssLsSourceMaps.value),
		getJsonSourceMaps: untrack(() => sfcJsons.sourceMaps.value),
		getTemplateSourceMaps: untrack(() => sfcTemplate.sourceMap.value ? [sfcTemplate.sourceMap.value] : []),
		getTemplateScriptData: untrack(() => templateScriptData),
		getDescriptor: untrack(() => sfc), // TODO: untrack not working for reactive
		getScriptAst: untrack(() => sfcScript.ast.value),
		getScriptSetupAst: untrack(() => sfcScriptSetup.ast.value),
		getVueHtmlDocument: untrack(() => vueHtmlDocument.value),
		getScriptSetupData: untrack(() => scriptSetupRanges.value),
		docLsScripts: untrack(() => ({
			documents: [sfcScript.textDocument.value, sfcScriptSetup.textDocument.value].filter(shared.notEmpty),
			sourceMaps: [sfcScript.sourceMap.value, sfcScriptSetup.sourceMap.value].filter(shared.notEmpty),
		})),
		getTemplateFormattingScript: untrack(() => ({
			document: sfcTemplateScript.textDocumentForFormatting.value,
			sourceMap: sfcTemplateScript.sourceMapForFormatting.value,
		})),
		getSfcRefSugarRanges: untrack(() => sfcRefSugarRanges.value),

		refs: {
			document,
			descriptor: sfc,
			lastUpdated,

			scriptSetupRanges,
			sfcJsons,
			sfcTemplate,
			sfcTemplateData,
			sfcTemplateCompileResult,
			sfcTemplateScript,
			sfcEntryForTemplateLs,
			sfcScriptForScriptLs,
			sfcScriptForTemplateLs,
			templateScriptData,

			cssLsDocuments,
			cssLsSourceMaps,
			scriptLsDocuments,
			scriptLsSourceMaps,
			templateLsDocuments,
			templateLsSourceMaps,
			templateLsTeleports,
		},
	};

	function update(newContent: string, newVersion: string) {

		const scriptLang_1 = sfcScriptForScriptLs.textDocument.value.languageId;
		const scriptText_1 = sfcScriptForScriptLs.textDocument.value.getText();
		const templateScriptVersion_1 = sfcTemplateScript.textDocument.value?.version;

		content.value = newContent;
		version.value = newVersion;
		const parsedSfc = shared.parseSfc(newContent, vueHtmlDocument.value);

		updateTemplate(parsedSfc['template']);
		updateScript(parsedSfc['script']);
		updateScriptSetup(parsedSfc['scriptSetup']);
		updateStyles(parsedSfc['styles']);
		updateCustomBlocks(parsedSfc['customBlocks']);

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
	function updateTemplateScript(templateTsLs: ts2.LanguageService) {
		const newVersion = templateTsLs.__internal__.host.getProjectVersion?.();
		if (templateScriptData.projectVersion === newVersion) {
			return false;
		}
		templateScriptData.projectVersion = newVersion;

		const options: ts.GetCompletionsAtPositionOptions = {
			includeCompletionsWithInsertText: true, // if missing, { 'aaa-bbb': any, ccc: any } type only has result ['ccc']
		};

		const doc = sfcEntryForTemplateLs.textDocument.value;
		const docText = doc.getText();
		const context = docText.indexOf(SearchTexts.Context) >= 0 ? templateTsLs.__internal__.doCompleteSync(doc.uri, doc.positionAt(docText.indexOf(SearchTexts.Context)), options)?.items ?? [] : [];
		let components = docText.indexOf(SearchTexts.Components) >= 0 ? templateTsLs.__internal__.doCompleteSync(doc.uri, doc.positionAt(docText.indexOf(SearchTexts.Components)), options)?.items ?? [] : [];
		const props = docText.indexOf(SearchTexts.Props) >= 0 ? templateTsLs.__internal__.doCompleteSync(doc.uri, doc.positionAt(docText.indexOf(SearchTexts.Props)), options)?.items ?? [] : [];
		const setupReturns = docText.indexOf(SearchTexts.SetupReturns) >= 0 ? templateTsLs.__internal__.doCompleteSync(doc.uri, doc.positionAt(docText.indexOf(SearchTexts.SetupReturns)), options)?.items ?? [] : [];

		components = components.filter(entry => {
			// @ts-expect-error
			const data: TsCompletionData = entry.data;
			return data.name.indexOf('$') === -1 && !data.name.startsWith('_');
		});

		// @ts-expect-error
		const contextNames = context.map(entry => (entry.data as TsCompletionData).name);
		// @ts-expect-error
		const componentNames = components.map(entry => (entry.data as TsCompletionData).name);
		// @ts-expect-error
		const propNames = props.map(entry => (entry.data as TsCompletionData).name);
		// @ts-expect-error
		const setupReturnNames = setupReturns.map(entry => (entry.data as TsCompletionData).name);

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
