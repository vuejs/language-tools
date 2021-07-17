import * as prettyhtml from '@starptech/prettyhtml';
import { eqSet, notEmpty, uriToFsPath } from '@volar/shared';
import type * as ts2 from 'vscode-typescript-languageservice';
import * as vueSfc from '@vue/compiler-sfc';
import { computed, ComputedRef, reactive, ref, Ref } from '@vue/reactivity';
import * as css from 'vscode-css-languageservice';
import * as json from 'vscode-json-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
	CompletionItem,
	Diagnostic,
	DiagnosticSeverity,
	DiagnosticTag,
	Range,
	DiagnosticRelatedInformation
} from 'vscode-languageserver/node';
import { IDescriptor, ITemplateScriptData, LanguageServiceContext } from './types';
import * as dedupe from './utils/dedupe';
import { SourceMap, TsSourceMap } from './utils/sourceMaps';
import { SearchTexts } from './utils/string';
import { useTemplateLsMainScript } from './virtuals/templateLsMainScript';
import { useTemplateLsScript } from './virtuals/templateLsScript';
import { useScriptRaw } from './virtuals/scriptRaw';
import { useStylesRaw } from './virtuals/styles.raw';
import { useJsonsRaw } from './virtuals/jsons.raw';
import { useTemplateLsTemplateScript } from './virtuals/templateLsTemplateScript';
import { useTemplateRaw } from './virtuals/template.raw';
import type { Data as TsCompletionData } from 'vscode-typescript-languageservice/src/services/completion';
import { untrack } from './utils/untrack';

export const defaultLanguages = {
	template: 'html',
	script: 'js',
	style: 'css',
};

export type SourceFile = ReturnType<typeof createSourceFile>;

export function createSourceFile(
	initialDocument: TextDocument,
	templateTsLs: ts2.LanguageService,
	scriptTsLs: ts2.LanguageService,
	context: LanguageServiceContext,
) {
	// sources
	const templateTsProjectVersion = ref<string>();
	const scriptTsProjectVersion = ref<string>();
	const vueDoc = ref(initialDocument);
	const vueUri = vueDoc.value.uri;
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
	const sfcErrors = ref<Diagnostic[]>([]);

	// virtual scripts
	const _virtualStyles = useStylesRaw(context.ts, untrack(() => vueDoc.value), computed(() => descriptor.styles), context);
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
		textDocuments: computed(() => [templateLsTemplateScript.cssTextDocument.value, ..._virtualStyles.textDocuments.value].filter(notEmpty)),
		sourceMaps: computed(() => [templateLsTemplateScript.cssSourceMap.value, ..._virtualStyles.sourceMaps.value].filter(notEmpty)),
	};
	const docLsScript = useScriptRaw(untrack(() => vueDoc.value), computed(() => descriptor.script));
	const docLsScriptSetup = useScriptRaw(untrack(() => vueDoc.value), computed(() => descriptor.scriptSetup));
	const templateLsScript = useTemplateLsScript('template', context.ts, vueDoc, computed(() => descriptor.script), computed(() => descriptor.scriptSetup), computed(() => templateData.value?.html));
	const templateLsMainScript = useTemplateLsMainScript(untrack(() => vueDoc.value), computed(() => descriptor.script), computed(() => descriptor.scriptSetup), computed(() => descriptor.template));
	const scriptLsScript = useTemplateLsScript('script', context.ts, vueDoc, computed(() => descriptor.script), computed(() => descriptor.scriptSetup), computed(() => templateData.value?.html));

	// map / set
	const templatetTsSourceMaps = computed(() => {
		const result = [
			templateLsScript.sourceMap.value,
			templateLsScript.sourceMapForSuggestion.value,
			templateLsTemplateScript.sourceMap.value,
			templateLsMainScript.sourceMap.value,
			// scriptLsScript.sourceMap.value,
		].filter(notEmpty);
		return result;
	});
	const templateLsDocs = computed(() => {

		const docs = new Map<string, TextDocument>();

		docs.set(templateLsMainScript.textDocument.value.uri, templateLsMainScript.textDocument.value);
		docs.set(templateLsScript.textDocument.value.uri, templateLsScript.textDocument.value);
		if (templateLsScript.textDocumentForSuggestion.value)
			docs.set(templateLsScript.textDocumentForSuggestion.value.uri, templateLsScript.textDocumentForSuggestion.value);
		if (templateLsTemplateScript.textDocument.value)
			docs.set(templateLsTemplateScript.textDocument.value.uri, templateLsTemplateScript.textDocument.value);

		return docs;
	});
	const tsSourceMaps = computed(() => [
		scriptLsScript.sourceMap.value,
		...templatetTsSourceMaps.value,
	]);

	update(initialDocument);

	// getters
	const getComponentCompletionData = useComponentCompletionData();
	const getDiagnostics = useDiagnostics();

	return {
		uri: vueUri,
		getTemplateTagNames: untrack(() => templateLsTemplateScript.templateCodeGens.value?.tagNames),
		getTemplateAttrNames: untrack(() => templateLsTemplateScript.templateCodeGens.value?.attrNames),
		getTextDocument: untrack(() => vueDoc.value),
		update: untrack(update),
		updateTemplateScript: untrack(updateTemplateScript),
		getComponentCompletionData: untrack(getComponentCompletionData),
		getDiagnostics: untrack(getDiagnostics),
		getScriptTsDocument: untrack(() => scriptLsScript.textDocument.value),
		getTsSourceMaps: untrack(() => tsSourceMaps.value),
		getCssSourceMaps: untrack(() => cssLsStyles.sourceMaps.value),
		getJsonSourceMaps: untrack(() => virtualJsonBlocks.sourceMaps.value),
		getHtmlSourceMaps: untrack(() => virtualTemplateRaw.htmlSourceMap.value ? [virtualTemplateRaw.htmlSourceMap.value] : []),
		getPugSourceMaps: untrack(() => virtualTemplateRaw.pugSourceMap.value ? [virtualTemplateRaw.pugSourceMap.value] : []),
		getTemplateScriptData: untrack(() => templateScriptData),
		getTeleports: untrack(() => [
			templateLsTemplateScript.teleportSourceMap.value,
			templateLsScript.teleportSourceMap.value,
		].filter(notEmpty)),
		getDescriptor: untrack(() => descriptor),
		getVueHtmlDocument: untrack(() => vueHtmlDocument.value),
		getTemplateLsDocs: untrack(() => templateLsDocs.value),
		getVirtualScript: untrack(() => ({
			document: templateLsScript.textDocument.value,
			sourceMap: templateLsScript.sourceMap.value,
		})),
		getScriptSetupData: untrack(() => templateLsScript.scriptSetupRanges.value),
		docLsScripts: untrack(() => ({
			documents: [docLsScript.textDocument.value, docLsScriptSetup.textDocument.value].filter(notEmpty),
			sourceMaps: [docLsScript.sourceMap.value, docLsScriptSetup.sourceMap.value].filter(notEmpty),
		})),
		getTemplateFormattingScript: untrack(() => ({
			document: templateLsTemplateScript.textDocumentForFormatting.value,
			sourceMap: templateLsTemplateScript.sourceMapForFormatting.value,
		})),
		shouldVerifyTsScript: untrack(shouldVerifyTsScript),

		refs: {
			cssSourceMaps: cssLsStyles.sourceMaps,
			htmlSourceMap: virtualTemplateRaw.htmlSourceMap,
			templateTsSourceMaps: templatetTsSourceMaps,
			templateTsDocuments: templateLsDocs,
			templateMainTsDocument: templateLsMainScript.textDocument,
			templaetTsTeleports: computed(() => [
				templateLsTemplateScript.teleportSourceMap.value,
				templateLsScript.teleportSourceMap.value,
			].filter(notEmpty)),
			scriptTsDocument: scriptLsScript.textDocument,
			scriptTsTeleport: scriptLsScript.teleportSourceMap,
			scriptTsSourceMap: scriptLsScript.sourceMap,
		},
	};

	function update(newVueDocument: TextDocument) {
		const parsedSfc = vueSfc.parse(newVueDocument.getText(), { sourceMap: false });
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

		if (newVueDocument.getText() !== vueDoc.value.getText()) {
			vueDoc.value = newVueDocument;
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
			const errors: Diagnostic[] = [];
			for (const error of parsedSfc.errors) {
				if ('code' in error && error.loc) {
					const diag = Diagnostic.create(
						Range.create(
							error.loc.start.line - 1,
							error.loc.start.column - 1,
							error.loc.end.line - 1,
							error.loc.end.column - 1,
						),
						error.message,
						DiagnosticSeverity.Error,
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
	function updateTemplateScript() {
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

		if (eqSet(new Set(contextNames), new Set(templateScriptData.context))
			&& eqSet(new Set(componentNames), new Set(templateScriptData.components))
			&& eqSet(new Set(propNames), new Set(templateScriptData.props))
			&& eqSet(new Set(setupReturnNames), new Set(templateScriptData.setupReturns))
			&& eqSet(new Set(htmlElementNames), new Set(templateScriptData.htmlElements))
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
	function shouldVerifyTsScript(tsUri: string, mode: 1 | 2 | 3 | 4): 'all' | 'none' | 'unused' {
		if (tsUri.toLowerCase() === templateLsScript.textDocumentForSuggestion.value?.uri.toLowerCase()) {
			if (mode === 3) {
				return 'all';
			}
			if (mode === 1) {
				const tsOptions = templateTsLs.__internal__.host.getCompilationSettings();
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
	function useDiagnostics() {

		const tsOptions = templateTsLs.__internal__.host.getCompilationSettings();
		const anyNoUnusedEnabled = tsOptions.noUnusedLocals || tsOptions.noUnusedParameters;

		const nonTs: [{
			result: ComputedRef<Promise<Diagnostic[]> | Diagnostic[]>;
			cache: ComputedRef<Promise<Diagnostic[]> | Diagnostic[]>;
		}, number, Diagnostic[]][] = [
				[useStylesValidation(computed(() => cssLsStyles.textDocuments.value)), 0, []],
				[useJsonsValidation(computed(() => virtualJsonBlocks.textDocuments.value)), 0, []],
				[useTemplateValidation(), 0, []],
				[useScriptExistValidation(), 0, []],
			];
		let templateTs: [{
			result: ComputedRef<Diagnostic[]>;
			cache: ComputedRef<Diagnostic[]>;
		}, number, Diagnostic[]][] = [
				[useTemplateScriptValidation(1), 0, []],
				[useTemplateScriptValidation(2), 0, []],
				[useTemplateScriptValidation(3), 0, []],
			];
		let scriptTs: [{
			result: ComputedRef<Diagnostic[]>;
			cache: ComputedRef<Diagnostic[]>;
		}, number, Diagnostic[]][] = [
				[useScriptValidation(scriptLsScript.textDocument, 1), 0, []],
				[useScriptValidation(scriptLsScript.textDocument, 2), 0, []],
				[useScriptValidation(computed(() => scriptLsScript.textDocumentForSuggestion.value ?? scriptLsScript.textDocument.value), 3), 0, []],
				// [useScriptValidation(virtualScriptGen.textDocument, 4), 0, []], // TODO: support cancel because it's very slow
				[useScriptValidation(computed(() => anyNoUnusedEnabled ? scriptLsScript.textDocumentForSuggestion.value : undefined), 1, true), 0, []],
			];

		return async (response: (diags: Diagnostic[]) => void, isCancel?: () => Promise<boolean>) => {
			templateTsProjectVersion.value = templateTsLs.__internal__.host.getProjectVersion?.();
			scriptTsProjectVersion.value = scriptTsLs.__internal__.host.getProjectVersion?.();

			// sort by cost
			templateTs = templateTs.sort((a, b) => a[1] - b[1]);
			scriptTs = scriptTs.sort((a, b) => a[1] - b[1]);

			let all = [...nonTs];
			let mainTsErrorStart = all.length - 1;
			let mainTsErrorEnd = -1;

			const isScriptChanged = lastUpdateChanged.script || lastUpdateChanged.scriptSetup;
			if (isScriptChanged) {
				all = all.concat(scriptTs);
				mainTsErrorEnd = all.length - 1;
				all = all.concat(templateTs);
			}
			else {
				all = all.concat(templateTs);
				mainTsErrorEnd = all.length - 1;
				all = all.concat(scriptTs);
			}

			let isDirty = false;

			for (let i = 0; i < all.length; i++) {
				if (await isCancel?.()) return;
				const startTime = Date.now();
				const diag = all[i];
				if (!isDirty) {
					isDirty = isErrorsDirty(diag[2], await diag[0].result.value);
				}
				diag[2] = await diag[0].result.value;
				diag[1] = Date.now() - startTime;
				const _newErrors = all
					.slice(0, i + 1)
					.map(async diag => await diag[0].result.value)
					.flat()
				const newErrors = (await Promise.all(_newErrors))
					.flat()
					.concat(sfcErrors.value);
				const _oldErrors = all
					.slice(i + 1)
					.map(async diag => i >= mainTsErrorStart && !isScriptChanged ? await diag[0].cache.value : diag[2])
				const oldErrors = (await Promise.all(_oldErrors))
					.flat();;
				const isLast = i === all.length - 1
				if (await isCancel?.()) return;
				if (
					isLast
					|| (isDirty && (
						i < mainTsErrorStart
						|| i === mainTsErrorEnd
						|| oldErrors.length === 0
					))
				) {
					isDirty = false;
					response(dedupe.withDiagnostics(newErrors.concat(oldErrors)));
				}
			}

			function isErrorsDirty(oldErrors: Diagnostic[], newErrors: Diagnostic[]) {
				return !eqSet(errorsToKeys(oldErrors), errorsToKeys(newErrors));
			}
			function errorsToKeys(errors: Diagnostic[]) {
				return new Set(errors.map(error =>
					error.source
					+ ':' + error.code
					+ ':' + error.message
				));
			}
		}

		function useTemplateValidation() {
			const htmlErrors = computed(() => {
				if (virtualTemplateRaw.textDocument.value && virtualTemplateRaw.htmlDocument.value) {
					return getVueCompileErrors(virtualTemplateRaw.textDocument.value);
				}
				return [];
			});
			const pugErrors = computed(() => {
				const result: Diagnostic[] = [];
				if (virtualTemplateRaw.textDocument.value && virtualTemplateRaw.pugDocument.value) {
					const pugDoc = virtualTemplateRaw.pugDocument.value;
					const astError = pugDoc.error;
					if (astError) {
						result.push({
							code: astError.code,
							message: astError.msg,
							range: {
								start: { line: astError.line, character: astError.column },
								end: { line: astError.line, character: astError.column },
							},
						});
					}
					else {
						const htmlDoc = pugDoc.sourceMap.mappedDocument;
						const vueCompileErrors = getVueCompileErrors(htmlDoc);
						for (const vueCompileError of vueCompileErrors) {
							let pugRange: Range | undefined = pugDoc.sourceMap.getSourceRange(vueCompileError.range.start, vueCompileError.range.end);
							if (!pugRange) {
								const pugStart = pugDoc.sourceMap.getSourceRange(vueCompileError.range.start, vueCompileError.range.start)?.start;
								const pugEnd = pugDoc.sourceMap.getSourceRange(vueCompileError.range.end, vueCompileError.range.end)?.end;
								if (pugStart && pugEnd) {
									pugRange = {
										start: pugStart,
										end: pugEnd,
									};
									// trim empty space
									const pugText = pugDoc.sourceMap.sourceDocument.getText(pugRange);
									const trimLength = pugText.length - pugText.trimEnd().length;
									if (trimLength) {
										pugRange.end = pugDoc.sourceMap.sourceDocument.positionAt(
											pugDoc.sourceMap.sourceDocument.offsetAt(pugEnd)
											- trimLength
										);
									}
								}
							}

							if (pugRange) {
								vueCompileError.range = pugRange;
								result.push(vueCompileError);
							}
							else {
								let htmlText = htmlDoc.getText(vueCompileError.range);
								let errorText = '';
								try {
									errorText += '\n```html\n' + prettyhtml(htmlText).contents.trim() + '\n```'; // may thorw
								} catch (error) {
									errorText += '\n```html\n' + htmlText.trim() + '\n```'; // may thorw
									errorText += '\n```json\n' + JSON.stringify(error, null, 2) + '\n```';
								}
								vueCompileError.message += errorText;
								vueCompileError.range = {
									start: virtualTemplateRaw.textDocument.value.positionAt(0),
									end: virtualTemplateRaw.textDocument.value.positionAt(virtualTemplateRaw.textDocument.value.getText().length),
								};
								result.push(vueCompileError);
							}
						}
					}
				}
				return result;
			});
			const htmlErrors_cache = ref<Diagnostic[]>([]);
			const pugErrors_cache = ref<Diagnostic[]>([]);
			const result = computed(() => {
				htmlErrors_cache.value = htmlErrors.value;
				pugErrors_cache.value = pugErrors.value;
				return cacheWithSourceMap.value;
			});
			const cacheWithSourceMap = computed(() => {
				if (!virtualTemplateRaw.textDocument.value) return [];
				return [
					...toSourceDiags(htmlErrors.value, virtualTemplateRaw.textDocument.value.uri, virtualTemplateRaw.htmlSourceMap.value ? [virtualTemplateRaw.htmlSourceMap.value] : []),
					...toSourceDiags(pugErrors.value, virtualTemplateRaw.textDocument.value.uri, virtualTemplateRaw.pugSourceMap.value ? [virtualTemplateRaw.pugSourceMap.value] : []),
				];
			});
			return {
				result,
				cache: cacheWithSourceMap,
			};

			function getVueCompileErrors(doc: TextDocument) {
				const result: Diagnostic[] = [];
				try {
					const templateResult = vueSfc.compileTemplate({
						source: doc.getText(),
						filename: uriToFsPath(vueUri),
						id: uriToFsPath(vueUri),
						compilerOptions: {
							onError: err => {
								if (!err.loc) return;

								const diagnostic: Diagnostic = {
									range: {
										start: doc.positionAt(err.loc.start.offset),
										end: doc.positionAt(err.loc.end.offset),
									},
									severity: DiagnosticSeverity.Error,
									code: err.code,
									source: 'vue',
									message: err.message,
								};
								result.push(diagnostic);
							},
						}
					});

					for (const err of templateResult.errors) {
						if (typeof err !== 'object' || !err.loc)
							continue;

						const diagnostic: Diagnostic = {
							range: {
								start: doc.positionAt(err.loc.start.offset),
								end: doc.positionAt(err.loc.end.offset),
							},
							severity: DiagnosticSeverity.Error,
							source: 'vue',
							code: err.code,
							message: err.message,
						};
						result.push(diagnostic);
					}
				}
				catch (err) {
					const diagnostic: Diagnostic = {
						range: {
							start: doc.positionAt(0),
							end: doc.positionAt(doc.getText().length),
						},
						severity: DiagnosticSeverity.Error,
						code: err.code,
						source: 'vue',
						message: err.message,
					};
					result.push(diagnostic);
				}
				return result;
			}
		}
		function useStylesValidation(documents: Ref<{ textDocument: TextDocument, stylesheet: css.Stylesheet | undefined }[]>) {
			const errors = computed(() => {
				let result = new Map<string, css.Diagnostic[]>();
				for (const { textDocument, stylesheet } of documents.value) {
					const cssLs = context.getCssLs(textDocument.languageId);
					if (!cssLs || !stylesheet) continue;
					const errs = cssLs.doValidation(textDocument, stylesheet);
					if (errs) result.set(textDocument.uri, errs);
				}
				return result;
			});
			const errors_cache = ref<Map<string, css.Diagnostic[]>>(new Map());
			const result = computed(() => {
				errors_cache.value = errors.value;
				return cacheWithSourceMap.value;
			});
			const cacheWithSourceMap = computed(() => {
				let result: css.Diagnostic[] = [];
				for (const [uri, errs] of errors_cache.value) {
					result = result.concat(toSourceDiags(errs, uri, cssLsStyles.sourceMaps.value));
				}
				return result as Diagnostic[];
			});
			return {
				result,
				cache: cacheWithSourceMap,
			};
		}
		function useJsonsValidation(documents: Ref<{ textDocument: TextDocument, jsonDocument: json.JSONDocument }[]>) {
			const errors = computed(async () => {
				let result = new Map<string, css.Diagnostic[]>();
				for (const { textDocument, jsonDocument } of documents.value) {
					const errs = await context.jsonLs.doValidation(textDocument, jsonDocument, textDocument.languageId === 'json'
						? {
							comments: 'error',
							trailingCommas: 'error',
						}
						: {
							comments: 'ignore',
							trailingCommas: 'warning',
						});
					if (errs) {
						for (const err of errs) {
							err.source = err.source ?? 'json';
						}
						result.set(textDocument.uri, errs);
					}
				}
				return result;
			});
			const errors_cache = ref<Promise<Map<string, css.Diagnostic[]>>>();
			const result = computed(() => {
				errors_cache.value = errors.value;
				return cacheWithSourceMap.value;
			});
			const cacheWithSourceMap = computed(async () => {
				let result: css.Diagnostic[] = [];
				if (errors_cache.value) {
					for (const [uri, errs] of await errors_cache.value) {
						result = result.concat(toSourceDiags(errs, uri, virtualJsonBlocks.sourceMaps.value));
					}
				}
				return result as Diagnostic[];
			});
			return {
				result,
				cache: cacheWithSourceMap,
			};
		}
		function useScriptExistValidation() {
			const result = computed(() => {
				const diags: Diagnostic[] = [];
				if (!scriptTsLs.__internal__.getValidTextDocument(scriptLsScript.textDocument.value.uri)) {
					for (const script of [descriptor.script, descriptor.scriptSetup]) {
						if (!script || script.content === '') continue;
						const error = Diagnostic.create(
							{
								start: vueDoc.value.positionAt(script.loc.start),
								end: vueDoc.value.positionAt(script.loc.end),
							},
							'Virtual script not found, may missing lang="ts" or "allowJs": true.',
							DiagnosticSeverity.Information,
							undefined,
							'volar',
						);
						error.tags = [DiagnosticTag.Unnecessary];
						diags.push(error);
					}
				}
				return diags;
			});
			return {
				result,
				cache: result,
			};
		}
		function useScriptValidation(document: Ref<TextDocument | undefined>, mode: 1 | 2 | 3 | 4, onlyUnusedCheck = false) {
			const errors = computed(() => {
				if (mode === 1) { // watching
					scriptTsProjectVersion.value;
				}
				const doc = document.value;
				if (!doc) return [];
				if (mode === 1) {
					return scriptTsLs.doValidation(doc.uri, { semantic: true });
				}
				else if (mode === 2) {
					return scriptTsLs.doValidation(doc.uri, { syntactic: true });
				}
				else if (mode === 3) {
					return scriptTsLs.doValidation(doc.uri, { suggestion: true });
				}
				else if (mode === 4) {
					return scriptTsLs.doValidation(doc.uri, { declaration: true });
				}
				return [];
			});
			const errors_cache = ref<Diagnostic[]>([]);
			const result = computed(() => {
				errors_cache.value = errors.value;
				return cacheWithSourceMap.value;
			});
			const cacheWithSourceMap = computed(() => {
				const doc = document.value;
				if (!doc) return [];
				let result = toTsSourceDiags('script', errors_cache.value, doc.uri, templatetTsSourceMaps.value);
				if (onlyUnusedCheck) {
					result = result.filter(error => error.tags?.includes(DiagnosticTag.Unnecessary));
				}
				return result;
			});
			return {
				result,
				cache: cacheWithSourceMap,
			};
		}
		function useTemplateScriptValidation(mode: 1 | 2 | 3 | 4) {
			const errors_1 = computed(() => {
				if (mode === 1) { // watching
					templateTsProjectVersion.value;
				}
				const doc = templateLsTemplateScript.textDocument.value;
				if (!doc) return [];
				if (mode === 1) {
					return templateTsLs.doValidation(doc.uri, { semantic: true });
				}
				else if (mode === 2) {
					return templateTsLs.doValidation(doc.uri, { syntactic: true });
				}
				else if (mode === 3) {
					return templateTsLs.doValidation(doc.uri, { suggestion: true });
				}
				else if (mode === 4) {
					return templateTsLs.doValidation(doc.uri, { declaration: true });
				}
				return [];
			});
			const errors_2 = computed(() => {
				const result: Diagnostic[] = [];
				if (!templateLsTemplateScript.textDocument.value
					|| !templateLsTemplateScript.teleportSourceMap.value
				) return result;
				for (const diag of errors_1.value) {
					const spanText = templateLsTemplateScript.textDocument.value.getText(diag.range);
					if (!templateScriptData.setupReturns.includes(spanText)) continue;
					const propRights = templateLsTemplateScript.teleportSourceMap.value.getMappedRanges(diag.range.start, diag.range.end);
					for (const propRight of propRights) {
						if (propRight.data.isAdditionalReference) continue;
						const definitions = templateTsLs.findDefinition(templateLsTemplateScript.textDocument.value.uri, propRight.start);
						for (const definition of definitions) {
							if (definition.targetUri !== templateLsScript.textDocument.value.uri) continue;
							result.push({
								...diag,
								range: definition.targetSelectionRange,
							});
						}
					}
				}
				return result;
			});
			const errors_1_cache = ref<Diagnostic[]>([]);
			const errors_2_cache = ref<Diagnostic[]>([]);
			const result = computed(() => {
				errors_1_cache.value = errors_1.value;
				errors_2_cache.value = errors_2.value;
				return cacheWithSourceMap.value;
			});
			const cacheWithSourceMap = computed(() => {
				const result_1 = templateLsTemplateScript.textDocument.value ? toTsSourceDiags(
					'template',
					errors_1_cache.value,
					templateLsTemplateScript.textDocument.value.uri,
					templatetTsSourceMaps.value,
				) : [];
				const result_2 = templateLsScript.textDocument.value ? toTsSourceDiags(
					'template',
					errors_2_cache.value,
					templateLsScript.textDocument.value.uri,
					templatetTsSourceMaps.value,
				) : [];
				return [...result_1, ...result_2];
			});
			return {
				result,
				cache: cacheWithSourceMap,
			};
		}
		function toSourceDiags<T = Diagnostic | css.Diagnostic>(errors: T[], virtualScriptUri: string, sourceMaps: SourceMap[]) {
			const result: T[] = [];
			for (const error of errors) {
				if (css.Diagnostic.is(error) || Diagnostic.is(error)) {
					for (const sourceMap of sourceMaps) {
						if (sourceMap.mappedDocument.uri !== virtualScriptUri)
							continue;
						const vueRange = sourceMap.getSourceRange(error.range.start, error.range.end);
						if (!vueRange)
							continue;
						result.push({
							...error,
							range: vueRange,
						});
					}
				}
			}
			return result;
		}
		function toTsSourceDiags(lsType: 'template' | 'script', errors: Diagnostic[], virtualScriptUri: string, sourceMaps: TsSourceMap[]) {
			const result: Diagnostic[] = [];
			for (const error of errors) {
				const vueRange = findVueRange(virtualScriptUri, error.range);
				if (vueRange) {
					const vueError: Diagnostic = {
						...error,
						range: vueRange,
					};
					if (vueError.relatedInformation) {
						const vueInfos: DiagnosticRelatedInformation[] = [];
						for (const info of vueError.relatedInformation) {
							const vueInfoRange = findVueRange(info.location.uri, info.location.range);
							if (vueInfoRange) {
								vueInfos.push({
									location: {
										uri: vueInfoRange.uri,
										range: vueInfoRange,
									},
									message: info.message,
								});
							}
						}
						vueError.relatedInformation = vueInfos;
					}
					result.push(vueError);
				}
			}
			return result;

			function findVueRange(virtualUri: string, virtualRange: Range) {
				for (const sourceMap of sourceMaps) {
					if (sourceMap.mappedDocument.uri === virtualUri) {

						const vueRange = sourceMap.getSourceRange(virtualRange.start, virtualRange.end);
						if (vueRange && vueRange.data.capabilities.diagnostic) {
							return {
								uri: vueUri,
								start: vueRange.start,
								end: vueRange.end,
							};
						}

						// patching for ref sugar
						// TODO: move to source map
						const vueStartRange = sourceMap.getSourceRange(virtualRange.start);
						if (vueStartRange && vueStartRange.data.capabilities.diagnostic) {
							const vueEndRange = sourceMap.getSourceRange(virtualRange.end);
							if (vueStartRange && vueEndRange && vueStartRange.data.capabilities.diagnostic && vueEndRange.data.capabilities.diagnostic) {
								return {
									uri: vueUri,
									start: vueStartRange.start,
									end: vueEndRange.start,
								};
							}
						}
					}
				}
				if ('sourceFiles' in context) {
					for (const vueLoc of context.sourceFiles.fromTsLocation(lsType, virtualUri, virtualRange.start, virtualRange.end)) {
						if (vueLoc.type === 'source-ts' || vueLoc.range.data.capabilities.diagnostic) {
							return {
								uri: vueLoc.uri,
								start: vueLoc.range.start,
								end: vueLoc.range.end,
							};
						}
					}
				}
			}
		}
	}
	function useComponentCompletionData() {
		const result = computed(() => {
			{ // watching
				templateTsProjectVersion.value;
			}
			const data = new Map<string, { item: CompletionItem | undefined, bind: CompletionItem[], on: CompletionItem[], slot: CompletionItem[] }>();
			if (templateLsTemplateScript.textDocument.value && virtualTemplateRaw.textDocument.value) {
				const doc = templateLsTemplateScript.textDocument.value;
				const text = doc.getText();
				for (const tag of [...templateScriptData.componentItems, ...templateScriptData.htmlElementItems]) {
					const tagName = (tag.data as TsCompletionData).name;
					let bind: CompletionItem[] = [];
					let on: CompletionItem[] = [];
					let slot: CompletionItem[] = [];
					{
						const searchText = `__VLS_componentPropsBase['${tagName}']['`;
						let offset = text.indexOf(searchText);
						if (offset >= 0) {
							offset += searchText.length;
							bind = templateTsLs.__internal__.doCompleteSync(doc.uri, doc.positionAt(offset));
						}
					}
					{
						const searchText = `__VLS_componentEmits['${tagName}']('`;
						let offset = text.indexOf(searchText);
						if (offset >= 0) {
							offset += searchText.length;
							on = templateTsLs.__internal__.doCompleteSync(doc.uri, doc.positionAt(offset));
						}
					}
					{
						const searchText = `__VLS_components_0['${tagName}'].__VLS_slots['`;
						let offset = text.indexOf(searchText);
						if (offset >= 0) {
							offset += searchText.length;
							slot = templateTsLs.__internal__.doCompleteSync(doc.uri, doc.positionAt(offset));
						}
					}
					data.set(tagName, { item: tag, bind, on, slot });
				}
				const globalBind = templateTsLs.__internal__.doCompleteSync(doc.uri, doc.positionAt(doc.getText().indexOf(SearchTexts.GlobalAttrs)));
				data.set('*', { item: undefined, bind: globalBind, on: [], slot: [] });
			}
			return data;
		});
		return () => {
			templateTsProjectVersion.value = templateTsLs.__internal__.host.getProjectVersion?.();
			return result.value;
		};
	}
}
