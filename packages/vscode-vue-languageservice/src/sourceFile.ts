import * as shared from '@volar/shared';
import * as vueSfc from '@vue/compiler-sfc';
import { computed, reactive, ref } from '@vue/reactivity';
import * as vscode from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type * as ts2 from 'vscode-typescript-languageservice';
import type { Data as TsCompletionData } from 'vscode-typescript-languageservice/src/services/completion';
import { IDescriptor, ITemplateScriptData, LanguageServiceContext } from './types';
import { SearchTexts } from './utils/string';
import { untrack } from './utils/untrack';
import { useJsonsRaw } from './virtuals/jsons.raw';
import { useScriptRaw } from './virtuals/scriptRaw';
import { useStylesRaw } from './virtuals/styles.raw';
import { useTemplateRaw } from './virtuals/template.raw';
import { useTemplateLsMainScript } from './virtuals/templateLsMainScript';
import { useTemplateLsScript } from './virtuals/templateLsScript';
import { useTemplateLsTemplateScript } from './virtuals/templateLsTemplateScript';

export const defaultLanguages = {
	template: 'html',
	script: 'js',
	style: 'css',
};

export type SourceFile = ReturnType<typeof createSourceFile>;

export function createSourceFile(
	document: TextDocument,
	context: LanguageServiceContext,
) {
	// sources
	const vueDoc = ref(document);
	const descriptor = reactive<IDescriptor>({
		template: null,
		script: null,
		scriptSetup: null,
		styles: [],
		customBlocks: [],
	});
	const lastUpdateChanged = {
		template: false,
		script: false,
		scriptSetup: false,
	};
	const templateScriptData = reactive<ITemplateScriptData>({
		projectVersion: undefined,
		context: [],
		components: [],
		props: [],
		setupReturns: [],
		htmlElements: [],
		componentItems: [],
		htmlElementItems: [],
	});
	const vueHtmlDocument = computed(() => {
		return context.htmlLs.parseHTMLDocument(vueDoc.value);
	});
	const sfcErrors = ref<vscode.Diagnostic[]>([]);

	// virtual scripts
	const _virtualStyles = useStylesRaw(context, untrack(() => vueDoc.value), computed(() => descriptor.styles));
	const virtualJsonBlocks = useJsonsRaw(untrack(() => vueDoc.value), computed(() => descriptor.customBlocks), context);
	const virtualTemplateRaw = useTemplateRaw(untrack(() => vueDoc.value), computed(() => descriptor.template), context);
	const templateData = computed<undefined | {
		sourceLang: 'html' | 'pug',
		html: string,
		htmlToTemplate: (start: number, end: number) => number | undefined,
	}>(() => {
		if (virtualTemplateRaw.pugDocument.value) {
			const pugDoc = virtualTemplateRaw.pugDocument.value;
			return {
				sourceLang: 'pug',
				html: pugDoc.htmlCode,
				htmlToTemplate: (htmlStart: number, htmlEnd: number) => {
					const pugRange = pugDoc.sourceMap.getSourceRange2(htmlStart, htmlEnd);
					if (pugRange) {
						return pugRange.start;
					}
				},
			}
		}
		if (descriptor.template) {
			return {
				sourceLang: 'html',
				html: descriptor.template.content,
				htmlToTemplate: (htmlStart: number, _: number) => htmlStart,
			}
		}
	});
	const templateLsTemplateScript = useTemplateLsTemplateScript(
		untrack(() => vueDoc.value),
		computed(() => descriptor.template),
		templateScriptData,
		_virtualStyles.textDocuments,
		_virtualStyles.sourceMaps,
		templateData,
		context,
	);
	const cssLsStyles = {
		textDocuments: computed(() => [templateLsTemplateScript.cssTextDocument.value, ..._virtualStyles.textDocuments.value].filter(shared.notEmpty)),
		sourceMaps: computed(() => [templateLsTemplateScript.cssSourceMap.value, ..._virtualStyles.sourceMaps.value].filter(shared.notEmpty)),
	};
	const docLsScript = useScriptRaw(untrack(() => vueDoc.value), computed(() => descriptor.script));
	const docLsScriptSetup = useScriptRaw(untrack(() => vueDoc.value), computed(() => descriptor.scriptSetup));
	const templateLsScript = useTemplateLsScript('template', context.modules.typescript, vueDoc, computed(() => descriptor.script), computed(() => descriptor.scriptSetup), computed(() => templateData.value?.html));
	const templateLsMainScript = useTemplateLsMainScript(untrack(() => vueDoc.value), computed(() => descriptor.script), computed(() => descriptor.scriptSetup), computed(() => descriptor.template));
	const scriptLsScript = useTemplateLsScript('script', context.modules.typescript, vueDoc, computed(() => descriptor.script), computed(() => descriptor.scriptSetup), computed(() => templateData.value?.html));

	// map / set
	const templatetTsSourceMaps = computed(() => {
		const result = [
			templateLsScript.sourceMap.value,
			templateLsTemplateScript.sourceMap.value,
			templateLsMainScript.sourceMap.value,
		].filter(shared.notEmpty);
		return result;
	});
	const scriptTsSourceMaps = computed(() => {
		const result = [
			scriptLsScript.sourceMap.value,
			scriptLsScript.sourceMapForSuggestion.value,
		].filter(shared.notEmpty);
		return result;
	});
	const templateLsDocuments = computed(() => {

		const docs = new Map<string, TextDocument>();

		docs.set(templateLsMainScript.textDocument.value.uri, templateLsMainScript.textDocument.value);
		docs.set(templateLsScript.textDocument.value.uri, templateLsScript.textDocument.value);

		if (templateLsTemplateScript.textDocument.value)
			docs.set(templateLsTemplateScript.textDocument.value.uri, templateLsTemplateScript.textDocument.value);

		return docs;
	});
	const scriptLsDocuments = computed(() => {

		const docs = new Map<string, TextDocument>();

		docs.set(scriptLsScript.textDocument.value.uri, scriptLsScript.textDocument.value);

		if (scriptLsScript.textDocumentForSuggestion.value)
			docs.set(scriptLsScript.textDocumentForSuggestion.value.uri, scriptLsScript.textDocumentForSuggestion.value);

		return docs;
	});
	const allTsSourceMaps = computed(() => [
		scriptLsScript.sourceMap.value,
		...templatetTsSourceMaps.value,
	]);

	update(document);

	return {
		uri: document.uri,
		getTemplateTagNames: untrack(() => templateLsTemplateScript.templateCodeGens.value?.tagNames),
		getTemplateAttrNames: untrack(() => templateLsTemplateScript.templateCodeGens.value?.attrNames),
		getTextDocument: untrack(() => vueDoc.value),
		update: untrack(update),
		updateTemplateScript: untrack(updateTemplateScript),
		getScriptTsDocument: untrack(() => scriptLsScript.textDocument.value),
		getScriptTsSourceMap: untrack(() => scriptLsScript.sourceMap.value),
		getTsSourceMaps: untrack(() => allTsSourceMaps.value),
		getCssSourceMaps: untrack(() => cssLsStyles.sourceMaps.value),
		getJsonSourceMaps: untrack(() => virtualJsonBlocks.sourceMaps.value),
		getHtmlSourceMaps: untrack(() => virtualTemplateRaw.htmlSourceMap.value ? [virtualTemplateRaw.htmlSourceMap.value] : []),
		getPugSourceMaps: untrack(() => virtualTemplateRaw.pugSourceMap.value ? [virtualTemplateRaw.pugSourceMap.value] : []),
		getTemplateScriptData: untrack(() => templateScriptData),
		getTeleports: untrack(() => [
			templateLsTemplateScript.teleportSourceMap.value,
			templateLsScript.teleportSourceMap.value,
		].filter(shared.notEmpty)),
		getDescriptor: untrack(() => descriptor),
		getVueHtmlDocument: untrack(() => vueHtmlDocument.value),
		getVirtualScript: untrack(() => ({
			document: templateLsScript.textDocument.value,
			sourceMap: templateLsScript.sourceMap.value,
		})),
		getScriptSetupData: untrack(() => templateLsScript.scriptSetupRanges.value),
		docLsScripts: untrack(() => ({
			documents: [docLsScript.textDocument.value, docLsScriptSetup.textDocument.value].filter(shared.notEmpty),
			sourceMaps: [docLsScript.sourceMap.value, docLsScriptSetup.sourceMap.value].filter(shared.notEmpty),
		})),
		getTemplateFormattingScript: untrack(() => ({
			document: templateLsTemplateScript.textDocumentForFormatting.value,
			sourceMap: templateLsTemplateScript.sourceMapForFormatting.value,
		})),
		shouldVerifyTsScript: untrack(shouldVerifyTsScript),

		refs: {
			// diagnostics / completioins
			cssLsStyles,
			virtualJsonBlocks,
			scriptLsScript,
			lastUpdateChanged,
			sfcErrors,
			virtualTemplateRaw,
			descriptor,
			vueDoc,
			templateLsTemplateScript,
			templateScriptData,
			templateLsScript,
			templatetTsSourceMaps,

			// source files
			cssSourceMaps: cssLsStyles.sourceMaps,
			htmlSourceMap: virtualTemplateRaw.htmlSourceMap,
			templateTsSourceMaps: templatetTsSourceMaps,
			templateTsDocuments: templateLsDocuments,
			scriptTsDocuments: scriptLsDocuments,
			scriptTsTeleport: scriptLsScript.teleportSourceMap,
			scriptTsSourceMaps: scriptTsSourceMaps,
			templaetTsTeleports: computed(() => [
				templateLsTemplateScript.teleportSourceMap.value,
				templateLsScript.teleportSourceMap.value,
			].filter(shared.notEmpty)),
			scriptTsTeleports: computed(() => [
				scriptLsScript.teleportSourceMap.value,
			].filter(shared.notEmpty)),
		},
	};

	function update(newDocument: TextDocument) {
		const parsedSfc = vueSfc.parse(newDocument.getText(), { sourceMap: false, ignoreEmpty: false });
		const newDescriptor = parsedSfc.descriptor;
		const versionsBeforeUpdate = [
			templateLsScript.textDocument.value?.version,
			templateLsTemplateScript.textDocument.value?.version,
		];

		updateSfcErrors();
		updateTemplate(newDescriptor);
		updateScript(newDescriptor);
		updateScriptSetup(newDescriptor);
		updateStyles(newDescriptor);
		updateCustomBlocks(newDescriptor);
		templateLsTemplateScript.update(); // TODO

		if (newDocument.getText() !== vueDoc.value.getText()) {
			vueDoc.value = newDocument;
		}

		const versionsAfterUpdate = [
			templateLsScript.textDocument.value?.version,
			templateLsTemplateScript.textDocument.value?.version,
		];

		return {
			scriptUpdated: versionsBeforeUpdate[0] !== versionsAfterUpdate[0],
			templateScriptUpdated: versionsBeforeUpdate[1] !== versionsAfterUpdate[1],
		};

		function updateSfcErrors() {
			const errors: vscode.Diagnostic[] = [];
			for (const error of parsedSfc.errors) {
				if ('code' in error && error.loc) {
					const diag = vscode.Diagnostic.create(
						vscode.Range.create(
							error.loc.start.line - 1,
							error.loc.start.column - 1,
							error.loc.end.line - 1,
							error.loc.end.column - 1,
						),
						error.message,
						vscode.DiagnosticSeverity.Error,
						error.code,
						'vue',
					);
					errors.push(diag);
				}
			}
			sfcErrors.value = errors;
		}
		function updateTemplate(newDescriptor: vueSfc.SFCDescriptor) {
			const newData = newDescriptor.template ? {
				lang: newDescriptor.template.lang ?? defaultLanguages.template,
				content: newDescriptor.template.content,
				loc: {
					start: newDescriptor.template.loc.start.offset,
					end: newDescriptor.template.loc.end.offset,
				},
			} : null;

			lastUpdateChanged.template = descriptor.template?.content !== newData?.content;

			if (descriptor.template && newData) {
				descriptor.template.lang = newData.lang;
				descriptor.template.content = newData.content;
				descriptor.template.loc.start = newData.loc.start;
				descriptor.template.loc.end = newData.loc.end;
			}
			else {
				descriptor.template = newData;
			}
		}
		function updateScript(newDescriptor: vueSfc.SFCDescriptor) {
			const newData = newDescriptor.script ? {
				src: newDescriptor.script.src,
				lang: newDescriptor.script.lang ?? defaultLanguages.script,
				content: newDescriptor.script.content,
				loc: {
					start: newDescriptor.script.loc.start.offset,
					end: newDescriptor.script.loc.end.offset,
				},
			} : null;

			lastUpdateChanged.script = descriptor.script?.content !== newData?.content;

			if (descriptor.script && newData) {
				descriptor.script.src = newData.src;
				descriptor.script.lang = newData.lang;
				descriptor.script.content = newData.content;
				descriptor.script.loc.start = newData.loc.start;
				descriptor.script.loc.end = newData.loc.end;
			}
			else {
				descriptor.script = newData;
			}
		}
		function updateScriptSetup(newDescriptor: vueSfc.SFCDescriptor) {
			const newData = newDescriptor.scriptSetup ? {
				lang: newDescriptor.scriptSetup.lang ?? defaultLanguages.script,
				content: newDescriptor.scriptSetup.content,
				loc: {
					start: newDescriptor.scriptSetup.loc.start.offset,
					end: newDescriptor.scriptSetup.loc.end.offset,
				},
			} : null;

			lastUpdateChanged.scriptSetup = descriptor.scriptSetup?.content !== newData?.content;

			if (descriptor.scriptSetup && newData) {
				descriptor.scriptSetup.lang = newData.lang;
				descriptor.scriptSetup.content = newData.content;
				descriptor.scriptSetup.loc.start = newData.loc.start;
				descriptor.scriptSetup.loc.end = newData.loc.end;
			}
			else {
				descriptor.scriptSetup = newData;
			}
		}
		function updateStyles(newDescriptor: vueSfc.SFCDescriptor) {
			for (let i = 0; i < newDescriptor.styles.length; i++) {
				const style = newDescriptor.styles[i];
				const newData = {
					lang: style.lang ?? defaultLanguages.style,
					content: style.content,
					loc: {
						start: style.loc.start.offset,
						end: style.loc.end.offset,
					},
					module: !!style.module,
					scoped: !!style.scoped,
				};
				if (descriptor.styles.length > i) {
					descriptor.styles[i].lang = newData.lang;
					descriptor.styles[i].content = newData.content;
					descriptor.styles[i].loc.start = newData.loc.start;
					descriptor.styles[i].loc.end = newData.loc.end;
					descriptor.styles[i].module = newData.module;
					descriptor.styles[i].scoped = newData.scoped;
				}
				else {
					descriptor.styles.push(newData);
				}
			}
			while (descriptor.styles.length > newDescriptor.styles.length) {
				descriptor.styles.pop();
			}
		}
		function updateCustomBlocks(newDescriptor: vueSfc.SFCDescriptor) {
			for (let i = 0; i < newDescriptor.customBlocks.length; i++) {
				const block = newDescriptor.customBlocks[i];
				const newData = {
					type: block.type,
					lang: block.lang ?? '',
					content: block.content,
					loc: {
						start: block.loc.start.offset,
						end: block.loc.end.offset,
					},
				};
				if (descriptor.customBlocks.length > i) {
					descriptor.customBlocks[i].type = newData.type;
					descriptor.customBlocks[i].lang = newData.lang;
					descriptor.customBlocks[i].content = newData.content;
					descriptor.customBlocks[i].loc.start = newData.loc.start;
					descriptor.customBlocks[i].loc.end = newData.loc.end;
				}
				else {
					descriptor.customBlocks.push(newData);
				}
			}
			while (descriptor.customBlocks.length > newDescriptor.customBlocks.length) {
				descriptor.customBlocks.pop();
			}
		}
	}
	function updateTemplateScript(templateTsLs: ts2.LanguageService) {
		const newVersion = templateTsLs.__internal__.host.getProjectVersion?.();
		if (templateScriptData.projectVersion === newVersion) {
			return false;
		}
		templateScriptData.projectVersion = newVersion;

		const doc = templateLsMainScript.textDocument.value;
		const docText = doc.getText();
		const context = docText.indexOf(SearchTexts.Context) >= 0 ? templateTsLs.__internal__.doCompleteSync(doc.uri, doc.positionAt(docText.indexOf(SearchTexts.Context))) : [];
		let components = docText.indexOf(SearchTexts.Components) >= 0 ? templateTsLs.__internal__.doCompleteSync(doc.uri, doc.positionAt(docText.indexOf(SearchTexts.Components))) : [];
		const props = docText.indexOf(SearchTexts.Props) >= 0 ? templateTsLs.__internal__.doCompleteSync(doc.uri, doc.positionAt(docText.indexOf(SearchTexts.Props))) : [];
		const setupReturns = docText.indexOf(SearchTexts.SetupReturns) >= 0 ? templateTsLs.__internal__.doCompleteSync(doc.uri, doc.positionAt(docText.indexOf(SearchTexts.SetupReturns))) : [];
		const globalEls = docText.indexOf(SearchTexts.HtmlElements) >= 0 ? templateTsLs.__internal__.doCompleteSync(doc.uri, doc.positionAt(doc.getText().indexOf(SearchTexts.HtmlElements))) : [];

		components = components.filter(entry => {
			const name = (entry.data as TsCompletionData).name;
			return name.indexOf('$') === -1 && !name.startsWith('_');
		});

		const contextNames = context.map(entry => (entry.data as TsCompletionData).name);
		const componentNames = components.map(entry => (entry.data as TsCompletionData).name);
		const propNames = props.map(entry => (entry.data as TsCompletionData).name);
		const setupReturnNames = setupReturns.map(entry => (entry.data as TsCompletionData).name);
		const htmlElementNames = globalEls.map(entry => (entry.data as TsCompletionData).name);

		if (shared.eqSet(new Set(contextNames), new Set(templateScriptData.context))
			&& shared.eqSet(new Set(componentNames), new Set(templateScriptData.components))
			&& shared.eqSet(new Set(propNames), new Set(templateScriptData.props))
			&& shared.eqSet(new Set(setupReturnNames), new Set(templateScriptData.setupReturns))
			&& shared.eqSet(new Set(htmlElementNames), new Set(templateScriptData.htmlElements))
		) {
			return false;
		}

		templateScriptData.context = contextNames;
		templateScriptData.components = componentNames;
		templateScriptData.props = propNames;
		templateScriptData.setupReturns = setupReturnNames;
		templateScriptData.htmlElements = htmlElementNames;
		templateScriptData.componentItems = components;
		templateScriptData.htmlElementItems = globalEls;
		templateLsTemplateScript.update(); // TODO
		return true;
	}
	function shouldVerifyTsScript(templateTsHost: ts.LanguageServiceHost, tsUri: string, mode: 1 | 2 | 3 | 4): 'all' | 'none' | 'unused' {
		if (tsUri.toLowerCase() === templateLsScript.textDocumentForSuggestion.value?.uri.toLowerCase()) {
			if (mode === 3) {
				return 'all';
			}
			if (mode === 1) {
				const tsOptions = templateTsHost.getCompilationSettings();
				const anyNoUnusedEnabled = tsOptions.noUnusedLocals || tsOptions.noUnusedParameters;
				return anyNoUnusedEnabled ? 'unused' : 'none';
			}
			return 'none';
		}
		if (tsUri.toLowerCase() === templateLsScript.textDocument.value?.uri.toLowerCase()) {
			if (mode === 3) {
				return !templateLsScript.textDocumentForSuggestion.value ? 'all' : 'none';
			}
			return 'all';
		}
		return 'all';
	}
}
