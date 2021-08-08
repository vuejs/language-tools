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
import { useSfcJsons } from './use/useSfcJsons';
import { useSfcScript } from './use/useSfcScript';
import { useSfcStyles } from './use/useSfcStyles';
import { useSfcTemplate } from './use/useSfcTemplate';
import { useSfcEntryForTemplateLs } from './use/useSfcEntryForTemplateLs';
import { useSfcScriptGen } from './use/useSfcScriptGen';
import { useSfcTemplateScript } from './use/useSfcTemplateScript';
import { useSfcTemplateCompileResult } from './use/useSfcTemplateCompileResult';

export const defaultLanguages = {
	template: 'html',
	script: 'js',
	style: 'css',
};

export type SourceFile = ReturnType<typeof createSourceFile>;

export function createSourceFile(
	_document: TextDocument,
	context: LanguageServiceContext,
) {

	// refs
	const document = ref(_document);
	const descriptor = reactive<IDescriptor>({
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
		components: [],
		props: [],
		setupReturns: [],
		componentItems: [],
	});
	const vueHtmlDocument = computed(() => {
		return context.htmlLs.parseHTMLDocument(document.value);
	});
	const sfcErrors = ref<vscode.Diagnostic[]>([]);

	// use
	const sfcStyles = useSfcStyles(context, untrack(() => document.value), computed(() => descriptor.styles));
	const sfcJsons = useSfcJsons(untrack(() => document.value), computed(() => descriptor.customBlocks), context);
	const sfcTemplate = useSfcTemplate(untrack(() => document.value), computed(() => descriptor.template), context);
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
					const pugRange = pugDoc.sourceMap.getSourceRange2(htmlStart, htmlEnd);
					if (pugRange) {
						return pugRange.start;
					}
				},
			};
		}
		if (descriptor.template && sfcTemplate.textDocument.value) {
			return {
				sourceLang: 'html',
				html: descriptor.template.content,
				htmlTextDocument: sfcTemplate.textDocument.value,
				htmlToTemplate: (htmlStart: number, _: number) => htmlStart,
			};
		}
	});
	const sfcTemplateCompileResult = useSfcTemplateCompileResult(computed(() => sfcTemplateData.value?.htmlTextDocument));
	const sfcTemplateScript = useSfcTemplateScript(
		untrack(() => document.value),
		computed(() => descriptor.template),
		templateScriptData,
		sfcStyles.textDocuments,
		sfcStyles.sourceMaps,
		sfcTemplateData,
		sfcTemplateCompileResult,
		context,
	);
	const sfcScript = useSfcScript(untrack(() => document.value), computed(() => descriptor.script));
	const sfcScriptSetup = useSfcScript(untrack(() => document.value), computed(() => descriptor.scriptSetup));
	const sfcScriptForTemplateLs = useSfcScriptGen('template', context.modules.typescript, document, computed(() => descriptor.script), computed(() => descriptor.scriptSetup), sfcTemplateCompileResult);
	const sfcScriptForScriptLs = useSfcScriptGen('script', context.modules.typescript, document, computed(() => descriptor.script), computed(() => descriptor.scriptSetup), sfcTemplateCompileResult);
	const sfcEntryForTemplateLs = useSfcEntryForTemplateLs(untrack(() => document.value), computed(() => descriptor.script), computed(() => descriptor.scriptSetup), computed(() => descriptor.template));

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
		sfcScriptForScriptLs.sourceMapForSuggestion.value,
	].filter(shared.notEmpty));
	const templateLsDocuments = computed(() => [
		sfcEntryForTemplateLs.textDocument.value,
		sfcScriptForTemplateLs.textDocument.value,
		sfcTemplateScript.textDocument.value,
	].filter(shared.notEmpty));
	const scriptLsDocuments = computed(() => [
		sfcScriptForScriptLs.textDocument.value,
		sfcScriptForScriptLs.textDocumentForSuggestion.value,
	].filter(shared.notEmpty));
	const tsSourceMaps = computed(() => [
		sfcScriptForScriptLs.sourceMap.value,
		...templateLsSourceMaps.value,
	]);
	const templateLsTeleports = computed(() => [
		sfcTemplateScript.teleportSourceMap.value,
		sfcScriptForTemplateLs.teleportSourceMap.value,
	].filter(shared.notEmpty));

	update(_document);

	return {
		uri: _document.uri,
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
		getDescriptor: untrack(() => descriptor),
		getVueHtmlDocument: untrack(() => vueHtmlDocument.value),
		getScriptSetupData: untrack(() => sfcScriptForTemplateLs.scriptSetupRanges.value),
		docLsScripts: untrack(() => ({
			documents: [sfcScript.textDocument.value, sfcScriptSetup.textDocument.value].filter(shared.notEmpty),
			sourceMaps: [sfcScript.sourceMap.value, sfcScriptSetup.sourceMap.value].filter(shared.notEmpty),
		})),
		getTemplateFormattingScript: untrack(() => ({
			document: sfcTemplateScript.textDocumentForFormatting.value,
			sourceMap: sfcTemplateScript.sourceMapForFormatting.value,
		})),
		shouldVerifyTsScript: untrack(shouldVerifyTsScript),

		refs: {
			document,
			descriptor,
			lastUpdated,
			sfcErrors,

			sfcJsons,
			sfcTemplate,
			sfcTemplateData,
			sfcTemplateCompileResult,
			sfcTemplateScript,
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

	function update(newDocument: TextDocument) {
		const parsedSfc = vueSfc.parse(newDocument.getText(), { sourceMap: false, ignoreEmpty: false });
		const newDescriptor = parsedSfc.descriptor;
		const versionsBeforeUpdate = [
			sfcScriptForTemplateLs.textDocument.value?.version,
			sfcTemplateScript.textDocument.value?.version,
		];

		updateSfcErrors();
		updateTemplate(newDescriptor);
		updateScript(newDescriptor);
		updateScriptSetup(newDescriptor);
		updateStyles(newDescriptor);
		updateCustomBlocks(newDescriptor);

		if (newDocument.getText() !== document.value.getText()) {
			document.value = newDocument;
		}

		sfcTemplateScript.update(sfcScriptForScriptLs.lang.value); // TODO

		const versionsAfterUpdate = [
			sfcScriptForTemplateLs.textDocument.value?.version,
			sfcTemplateScript.textDocument.value?.version,
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

			lastUpdated.template = descriptor.template?.content !== newData?.content;

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

			lastUpdated.script = descriptor.script?.content !== newData?.content;

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

			lastUpdated.scriptSetup = descriptor.scriptSetup?.content !== newData?.content;

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

		const doc = sfcEntryForTemplateLs.textDocument.value;
		const docText = doc.getText();
		const context = docText.indexOf(SearchTexts.Context) >= 0 ? templateTsLs.__internal__.doCompleteSync(doc.uri, doc.positionAt(docText.indexOf(SearchTexts.Context))) : [];
		let components = docText.indexOf(SearchTexts.Components) >= 0 ? templateTsLs.__internal__.doCompleteSync(doc.uri, doc.positionAt(docText.indexOf(SearchTexts.Components))) : [];
		const props = docText.indexOf(SearchTexts.Props) >= 0 ? templateTsLs.__internal__.doCompleteSync(doc.uri, doc.positionAt(docText.indexOf(SearchTexts.Props))) : [];
		const setupReturns = docText.indexOf(SearchTexts.SetupReturns) >= 0 ? templateTsLs.__internal__.doCompleteSync(doc.uri, doc.positionAt(docText.indexOf(SearchTexts.SetupReturns))) : [];

		components = components.filter(entry => {
			const name = (entry.data as TsCompletionData).name;
			return name.indexOf('$') === -1 && !name.startsWith('_');
		});

		const contextNames = context.map(entry => (entry.data as TsCompletionData).name);
		const componentNames = components.map(entry => (entry.data as TsCompletionData).name);
		const propNames = props.map(entry => (entry.data as TsCompletionData).name);
		const setupReturnNames = setupReturns.map(entry => (entry.data as TsCompletionData).name);

		if (shared.eqSet(new Set(contextNames), new Set(templateScriptData.context))
			&& shared.eqSet(new Set(componentNames), new Set(templateScriptData.components))
			&& shared.eqSet(new Set(propNames), new Set(templateScriptData.props))
			&& shared.eqSet(new Set(setupReturnNames), new Set(templateScriptData.setupReturns))
		) {
			return false;
		}

		templateScriptData.context = contextNames;
		templateScriptData.components = componentNames;
		templateScriptData.props = propNames;
		templateScriptData.setupReturns = setupReturnNames;
		templateScriptData.componentItems = components;
		sfcTemplateScript.update(sfcScriptForScriptLs.lang.value); // TODO
		return true;
	}
	function shouldVerifyTsScript(templateTsHost: ts.LanguageServiceHost, tsUri: string, mode: 1 | 2 | 3 | 4): 'all' | 'none' | 'unused' {
		if (tsUri.toLowerCase() === sfcScriptForTemplateLs.textDocumentForSuggestion.value?.uri.toLowerCase()) {
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
		if (tsUri.toLowerCase() === sfcScriptForTemplateLs.textDocument.value?.uri.toLowerCase()) {
			if (mode === 3) {
				return !sfcScriptForTemplateLs.textDocumentForSuggestion.value ? 'all' : 'none';
			}
			return 'all';
		}
		return 'all';
	}
}
