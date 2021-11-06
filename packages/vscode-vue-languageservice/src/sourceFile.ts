import * as shared from '@volar/shared';
import { parseRefSugarCallRanges, parseRefSugarDeclarationRanges } from '@volar/vue-code-gen/out/parsers/refSugarRanges';
import { parseScriptRanges } from '@volar/vue-code-gen/out/parsers/scriptRanges';
import { parseScriptSetupRanges } from '@volar/vue-code-gen/out/parsers/scriptSetupRanges';
import { computed, reactive, ref } from '@vue/reactivity';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type * as ts2 from 'vscode-typescript-languageservice';
import type { Data as TsCompletionData } from 'vscode-typescript-languageservice/src/services/completion';
import { ITemplateScriptData, LanguageServiceContext } from './types';
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

export type SourceFile = ReturnType<typeof createSourceFile>;

export function createSourceFile(
	uri: string,
	_content: string,
	_version: string,
	context: LanguageServiceContext,
) {

	// refs
	const content = ref('');
	const version = ref('');
	const descriptor = reactive<shared.Sfc>({
		template: null,
		script: null,
		scriptSetup: null,
		styles: [],
		customBlocks: [],
	});
	const lastUpdated = {
		template: false,
		script: false,
		scriptSetup: false,
	};
	const templateScriptData = reactive<ITemplateScriptData>({
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
	const vueHtmlDocument = computed(() => context.htmlLs.parseHTMLDocument(document.value));

	// use
	const sfcStyles = useSfcStyles(context, uri, document, computed(() => descriptor.styles));
	const sfcJsons = useSfcJsons(uri, document, computed(() => descriptor.customBlocks), context);
	const sfcTemplate = useSfcTemplate(uri, document, computed(() => descriptor.template), context);
	const sfcTemplateData = computed<undefined | {
		sourceLang: 'html' | 'pug',
		html: string,
		htmlTextDocument: TextDocument,
		htmlToTemplate: (start: number, end: number) => number | undefined,
	}>(() => {
		if (sfcTemplate.pugDocument.value) {
			const pugDoc = sfcTemplate.pugDocument.value;
			return {
				sourceLang: 'pug',
				html: pugDoc.htmlCode,
				htmlTextDocument: pugDoc.htmlTextDocument,
				htmlToTemplate: (htmlStart: number, htmlEnd: number) => {
					const pugRange = pugDoc.sourceMap.getSourceRange(htmlStart, htmlEnd);
					if (pugRange) {
						return pugRange.start;
					}
				},
			};
		}
		if (descriptor.template && sfcTemplate.textDocument.value && descriptor.template.lang === 'html') {
			return {
				sourceLang: 'html',
				html: descriptor.template.content,
				htmlTextDocument: sfcTemplate.textDocument.value,
				htmlToTemplate: (htmlStart: number, _: number) => htmlStart,
			};
		}
	});
	const sfcTemplateCompileResult = useSfcTemplateCompileResult(
		computed(() => sfcTemplateData.value?.htmlTextDocument),
		context.isVue2Mode,
	);
	const sfcScript = useSfcScript(
		uri,
		document,
		computed(() => descriptor.script),
		context.modules.typescript,
	);
	const sfcScriptSetup = useSfcScript(
		uri,
		document,
		computed(() => descriptor.scriptSetup),
		context.modules.typescript,
	);
	const scriptRanges = computed(() =>
		sfcScript.ast.value
			? parseScriptRanges(context.modules.typescript, sfcScript.ast.value, !!descriptor.scriptSetup, false, false)
			: undefined
	);
	const scriptSetupRanges = computed(() =>
		sfcScriptSetup.ast.value
			? parseScriptSetupRanges(context.modules.typescript, sfcScriptSetup.ast.value)
			: undefined
	);
	const sfcScriptForTemplateLs = useSfcScriptGen(
		'template',
		uri,
		document,
		computed(() => descriptor.script),
		computed(() => descriptor.scriptSetup),
		computed(() => scriptRanges.value),
		computed(() => scriptSetupRanges.value),
		sfcTemplateCompileResult,
		computed(() => sfcStyles.textDocuments.value),
		context.isVue2Mode,
	);
	const sfcScriptForScriptLs = useSfcScriptGen(
		'script',
		uri,
		document,
		computed(() => descriptor.script),
		computed(() => descriptor.scriptSetup),
		computed(() => scriptRanges.value),
		computed(() => scriptSetupRanges.value),
		sfcTemplateCompileResult,
		computed(() => sfcStyles.textDocuments.value),
		context.isVue2Mode,
	);
	const sfcEntryForTemplateLs = useSfcEntryForTemplateLs(
		uri,
		document,
		computed(() => descriptor.script),
		computed(() => descriptor.scriptSetup),
		computed(() => descriptor.template),
		computed(() => !!sfcScriptForTemplateLs.textDocumentTs.value),
		context.isVue2Mode,
	);
	const sfcTemplateScript = useSfcTemplateScript(
		uri,
		document,
		computed(() => descriptor.template),
		computed(() => descriptor.scriptSetup),
		computed(() => scriptSetupRanges.value),
		computed(() => descriptor.styles),
		templateScriptData,
		sfcStyles.textDocuments,
		sfcStyles.sourceMaps,
		sfcTemplateData,
		sfcTemplateCompileResult,
		computed(() => sfcStyles.textDocuments.value),
		sfcScriptForScriptLs.lang,
		context,
	);
	const sfcRefSugarRanges = computed(() => (sfcScriptSetup.ast.value ? {
		refs: parseRefSugarDeclarationRanges(context.modules.typescript, sfcScriptSetup.ast.value, ['$ref', '$computed', '$shallowRef', '$fromRefs']),
		raws: parseRefSugarCallRanges(context.modules.typescript, sfcScriptSetup.ast.value, ['$raw', '$fromRefs']),
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
		getHtmlSourceMaps: untrack(() => sfcTemplate.htmlSourceMap.value ? [sfcTemplate.htmlSourceMap.value] : []),
		getPugSourceMaps: untrack(() => sfcTemplate.pugSourceMap.value ? [sfcTemplate.pugSourceMap.value] : []),
		getTemplateScriptData: untrack(() => templateScriptData),
		getDescriptor: untrack(() => descriptor), // TODO: untrack not working for reactive
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
			descriptor,
			lastUpdated,

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

			lastUpdated.template = descriptor.template?.lang !== newData?.lang
				|| descriptor.template?.content !== newData?.content;

			if (descriptor.template && newData) {
				updateBlock(descriptor.template, newData);
			}
			else {
				descriptor.template = newData;
			}
		}
		function updateScript(newData: shared.Sfc['script']) {

			lastUpdated.script = descriptor.script?.lang !== newData?.lang
				|| descriptor.script?.content !== newData?.content;

			if (descriptor.script && newData) {
				updateBlock(descriptor.script, newData);
			}
			else {
				descriptor.script = newData;
			}
		}
		function updateScriptSetup(newData: shared.Sfc['scriptSetup']) {

			lastUpdated.scriptSetup = descriptor.scriptSetup?.lang !== newData?.lang
				|| descriptor.scriptSetup?.content !== newData?.content;

			if (descriptor.scriptSetup && newData) {
				updateBlock(descriptor.scriptSetup, newData);
			}
			else {
				descriptor.scriptSetup = newData;
			}
		}
		function updateStyles(newDataArr: shared.Sfc['styles']) {
			for (let i = 0; i < newDataArr.length; i++) {
				const newData = newDataArr[i];
				if (descriptor.styles.length > i) {
					updateBlock(descriptor.styles[i], newData);
				}
				else {
					descriptor.styles.push(newData);
				}
			}
			while (descriptor.styles.length > newDataArr.length) {
				descriptor.styles.pop();
			}
		}
		function updateCustomBlocks(newDataArr: shared.Sfc['customBlocks']) {
			for (let i = 0; i < newDataArr.length; i++) {
				const newData = newDataArr[i];
				if (descriptor.customBlocks.length > i) {
					updateBlock(descriptor.customBlocks[i], newData);
				}
				else {
					descriptor.customBlocks.push(newData);
				}
			}
			while (descriptor.customBlocks.length > newDataArr.length) {
				descriptor.customBlocks.pop();
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
			const name = (entry.data as TsCompletionData).name;
			return name.indexOf('$') === -1 && !name.startsWith('_');
		});

		const contextNames = context.map(entry => (entry.data as TsCompletionData).name);
		const componentNames = components.map(entry => (entry.data as TsCompletionData).name);
		const propNames = props.map(entry => (entry.data as TsCompletionData).name);
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
