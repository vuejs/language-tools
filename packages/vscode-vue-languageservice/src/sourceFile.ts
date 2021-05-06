import * as prettyhtml from '@starptech/prettyhtml';
import { eqSet, notEmpty, uriToFsPath } from '@volar/shared';
import type * as ts2 from 'vscode-typescript-languageservice';
import * as vueSfc from '@vue/compiler-sfc';
import { computed, ComputedRef, pauseTracking, reactive, ref, Ref, resetTracking } from '@vue/reactivity';
import * as css from 'vscode-css-languageservice';
import type { DocumentContext } from 'vscode-html-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
	CompletionItem,
	Diagnostic,
	DiagnosticSeverity,
	DiagnosticTag,
	Range
} from 'vscode-languageserver/node';
import { IDescriptor, ITemplateScriptData } from './types';
import * as dedupe from './utils/dedupe';
import * as languageServices from './utils/languageServices';
import { SourceMap, TsSourceMap } from './utils/sourceMaps';
import { SearchTexts } from './utils/string';
import { useScriptMain } from './virtuals/main';
import { useScriptSetupGen } from './virtuals/script';
import { useScriptFormat } from './virtuals/script.raw';
import { useStylesRaw } from './virtuals/styles.raw';
import { useTemplateScript } from './virtuals/template';
import { useTemplateRaw } from './virtuals/template.raw';

export const defaultLanguages = {
	template: 'html',
	script: 'js',
	style: 'css',
};

export type SourceFile = ReturnType<typeof createSourceFile>;

export function createSourceFile(
	initialDocument: TextDocument,
	tsLanguageService: ts2.LanguageService,
	ts: typeof import('typescript'),
	styleMode: 'api' | 'format',
	documentContext: DocumentContext | undefined,
) {
	// sources
	const tsProjectVersion = ref<string>();
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
		return languageServices.html.parseHTMLDocument(vueDoc.value);
	});
	const sfcErrors = ref<Diagnostic[]>([]);

	// virtual scripts
	const _virtualStyles = useStylesRaw(ts, untrack(() => vueDoc.value), computed(() => descriptor.styles), styleMode, documentContext);
	const virtualTemplateRaw = useTemplateRaw(untrack(() => vueDoc.value), computed(() => descriptor.template));
	const templateData = computed<undefined | {
		html?: string,
		htmlToTemplate?: (start: number, end: number) => number | undefined,
	}>(() => {
		if (virtualTemplateRaw.pugDocument.value) {
			const pugDoc = virtualTemplateRaw.pugDocument.value;
			return {
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
				html: descriptor.template.content,
			}
		}
	});
	const virtualTemplateGen = useTemplateScript(
		untrack(() => vueDoc.value),
		computed(() => descriptor.template),
		templateScriptData,
		_virtualStyles.textDocuments,
		_virtualStyles.sourceMaps,
		templateData,
	);
	const virtualStyles = {
		textDocuments: computed(() => [virtualTemplateGen.cssTextDocument.value, ..._virtualStyles.textDocuments.value].filter(notEmpty)),
		sourceMaps: computed(() => [virtualTemplateGen.cssSourceMap.value, ..._virtualStyles.sourceMaps.value].filter(notEmpty)),
	};
	const virtualScriptGen = useScriptSetupGen(ts, vueDoc, computed(() => descriptor.script), computed(() => descriptor.scriptSetup), computed(() => templateData.value?.html));
	const virtualScriptRaw = useScriptFormat(untrack(() => vueDoc.value), computed(() => descriptor.script));
	const virtualScriptSetupRaw = useScriptFormat(untrack(() => vueDoc.value), computed(() => descriptor.scriptSetup));
	const virtualScriptMain = useScriptMain(untrack(() => vueDoc.value), computed(() => descriptor.script), computed(() => descriptor.scriptSetup), computed(() => descriptor.template));

	// map / set
	const tsSourceMaps = computed(() => {
		const result = [
			virtualScriptGen.sourceMap.value,
			virtualScriptGen.sourceMapForSuggestion.value,
			virtualScriptGen.sourceMapForTemplate.value,
			virtualScriptMain.sourceMap.value,
			virtualTemplateGen.sourceMap.value,
		].filter(notEmpty);
		return result;
	});
	const tsDocuments = computed(() => {

		const docs = new Map<string, TextDocument>();

		docs.set(virtualScriptMain.textDocument.value.uri, virtualScriptMain.textDocument.value);
		if (virtualScriptGen.textDocument.value)
			docs.set(virtualScriptGen.textDocument.value.uri, virtualScriptGen.textDocument.value);
		if (virtualScriptGen.textDocumentForSuggestion.value)
			docs.set(virtualScriptGen.textDocumentForSuggestion.value.uri, virtualScriptGen.textDocumentForSuggestion.value);
		if (virtualScriptGen.textDocumentForTemplate.value)
			docs.set(virtualScriptGen.textDocumentForTemplate.value.uri, virtualScriptGen.textDocumentForTemplate.value);
		if (virtualTemplateGen.textDocument.value)
			docs.set(virtualTemplateGen.textDocument.value.uri, virtualTemplateGen.textDocument.value);

		return docs;
	});

	update(initialDocument);

	// getters
	const getComponentCompletionData = useComponentCompletionData();
	const getDiagnostics = useDiagnostics();

	return {
		uri: vueUri,
		getTemplateTagNames: untrack(() => virtualTemplateGen.templateCodeGens.value?.tagNames),
		getTemplateAttrNames: untrack(() => virtualTemplateGen.templateCodeGens.value?.attrNames),
		getTextDocument: untrack(() => vueDoc.value),
		update: untrack(update),
		updateTemplateScript: untrack(updateTemplateScript),
		getComponentCompletionData: untrack(getComponentCompletionData),
		getDiagnostics: untrack(getDiagnostics),
		getTsSourceMaps: untrack(() => tsSourceMaps.value),
		getMainTsDoc: untrack(() => virtualScriptMain.textDocument.value),
		getCssSourceMaps: untrack(() => virtualStyles.sourceMaps.value),
		getHtmlSourceMaps: untrack(() => virtualTemplateRaw.htmlSourceMap.value ? [virtualTemplateRaw.htmlSourceMap.value] : []),
		getPugSourceMaps: untrack(() => virtualTemplateRaw.pugSourceMap.value ? [virtualTemplateRaw.pugSourceMap.value] : []),
		getTemplateScriptData: untrack(() => templateScriptData),
		getTeleports: untrack(() => [
			virtualTemplateGen.teleportSourceMap.value,
			virtualScriptGen.teleportSourceMap.value,
		].filter(notEmpty)),
		getDescriptor: untrack(() => descriptor),
		getVueHtmlDocument: untrack(() => vueHtmlDocument.value),
		getTsDocuments: untrack(() => tsDocuments.value),
		getVirtualScript: untrack(() => ({
			document: virtualScriptGen.textDocument.value,
			sourceMap: virtualScriptGen.sourceMap.value,
		})),
		getScriptSetupData: untrack(() => virtualScriptGen.scriptSetupAst.value),
		getScriptsRaw: untrack(() => ({
			documents: [virtualScriptRaw.textDocument.value, virtualScriptSetupRaw.textDocument.value].filter(notEmpty),
			sourceMaps: [virtualScriptRaw.sourceMap.value, virtualScriptSetupRaw.sourceMap.value].filter(notEmpty),
		})),
		getTemplateScriptFormat: untrack(() => ({
			document: virtualTemplateGen.textDocumentForFormatting.value,
			sourceMap: virtualTemplateGen.sourceMapForFormatting.value,
		})),
		shouldVerifyTsScript: untrack(shouldVerifyTsScript),
	};

	function update(newVueDocument: TextDocument) {
		const parsedSfc = vueSfc.parse(newVueDocument.getText(), { sourceMap: false });
		const newDescriptor = parsedSfc.descriptor;
		const versionsBeforeUpdate = [
			virtualScriptGen.textDocument.value?.version,
			virtualTemplateGen.textDocument.value?.version,
		];

		updateSfcErrors();
		updateTemplate(newDescriptor);
		updateScript(newDescriptor);
		updateScriptSetup(newDescriptor);
		updateStyles(newDescriptor);
		updateCustomBlocks(newDescriptor);
		virtualTemplateGen.update(); // TODO

		if (newVueDocument.getText() !== vueDoc.value.getText()) {
			vueDoc.value = newVueDocument;
		}

		const versionsAfterUpdate = [
			virtualScriptGen.textDocument.value?.version,
			virtualTemplateGen.textDocument.value?.version,
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
				lang: newDescriptor.scriptSetup.lang ?? 'js',
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
		if (templateScriptData.projectVersion === tsLanguageService.__internal__.host.getProjectVersion?.()) {
			return false;
		}
		templateScriptData.projectVersion = tsLanguageService.__internal__.host.getProjectVersion?.();

		const doc = virtualScriptMain.textDocument.value;
		const docText = doc.getText();
		const context = docText.indexOf(SearchTexts.Context) >= 0 ? tsLanguageService.doComplete(doc.uri, doc.positionAt(docText.indexOf(SearchTexts.Context))) : [];
		let components = docText.indexOf(SearchTexts.Components) >= 0 ? tsLanguageService.doComplete(doc.uri, doc.positionAt(docText.indexOf(SearchTexts.Components))) : [];
		const props = docText.indexOf(SearchTexts.Props) >= 0 ? tsLanguageService.doComplete(doc.uri, doc.positionAt(docText.indexOf(SearchTexts.Props))) : [];
		const setupReturns = docText.indexOf(SearchTexts.SetupReturns) >= 0 ? tsLanguageService.doComplete(doc.uri, doc.positionAt(docText.indexOf(SearchTexts.SetupReturns))) : [];
		const globalEls = docText.indexOf(SearchTexts.HtmlElements) >= 0 ? tsLanguageService.doComplete(doc.uri, doc.positionAt(doc.getText().indexOf(SearchTexts.HtmlElements))) : [];

		components = components.filter(entry => {
			const name = entry.data.name as string;
			return name.indexOf('$') === -1 && !name.startsWith('_');
		});

		const contextNames = context.map(entry => entry.data.name);
		const componentNames = components.map(entry => entry.data.name);
		const propNames = props.map(entry => entry.data.name);
		const setupReturnNames = setupReturns.map(entry => entry.data.name);
		const htmlElementNames = globalEls.map(entry => entry.data.name);

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
		virtualTemplateGen.update(); // TODO
		return true;
	}
	function shouldVerifyTsScript(tsUri: string, mode: 1 | 2 | 3 | 4): 'all' | 'none' | 'unused' {
		if (tsUri.toLowerCase() === virtualScriptGen.textDocumentForSuggestion.value?.uri.toLowerCase()) {
			if (mode === 3) {
				return 'all';
			}
			if (mode === 1) {
				const tsOptions = tsLanguageService.__internal__.host.getCompilationSettings();
				const anyNoUnusedEnabled = tsOptions.noUnusedLocals || tsOptions.noUnusedParameters;
				return anyNoUnusedEnabled ? 'unused' : 'none';
			}
			return 'none';
		}
		if (tsUri.toLowerCase() === virtualScriptGen.textDocument.value?.uri.toLowerCase()) {
			if (mode === 3) {
				return !virtualScriptGen.textDocumentForSuggestion.value ? 'all' : 'none';
			}
			return 'all';
		}
		return 'all';
	}
	function useDiagnostics() {

		const tsOptions = tsLanguageService.__internal__.host.getCompilationSettings();
		const anyNoUnusedEnabled = tsOptions.noUnusedLocals || tsOptions.noUnusedParameters;

		const nonTs: [{
			result: ComputedRef<Diagnostic[]>;
			cache: ComputedRef<Diagnostic[]>;
		}, number, Diagnostic[]][] = [
				[useStylesValidation(computed(() => virtualStyles.textDocuments.value)), 0, []],
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
				[useScriptValidation(virtualScriptGen.textDocument, 1), 0, []],
				[useScriptValidation(virtualScriptGen.textDocument, 2), 0, []],
				[useScriptValidation(computed(() => virtualScriptGen.textDocumentForSuggestion.value ?? virtualScriptGen.textDocument.value), 3), 0, []],
				// [useScriptValidation(virtualScriptGen.textDocument, 4), 0, []], // TODO: support cancel because it's very slow
				[useScriptValidation(computed(() => anyNoUnusedEnabled ? virtualScriptGen.textDocumentForSuggestion.value : undefined), 1, true), 0, []],
			];

		return async (response: (diags: Diagnostic[]) => void, isCancel?: () => Promise<boolean>) => {
			tsProjectVersion.value = tsLanguageService.__internal__.host.getProjectVersion?.();

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
					isDirty = isErrorsDirty(diag[2], diag[0].result.value);
				}
				diag[2] = diag[0].result.value;
				diag[1] = Date.now() - startTime;
				const newErrors = all
					.slice(0, i + 1)
					.map(diag => diag[0].result.value)
					.flat()
					.concat(sfcErrors.value);
				const oldErrors = all
					.slice(i + 1)
					.map(diag => i >= mainTsErrorStart && !isScriptChanged ? diag[0].cache.value : diag[2])
					.flat();
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
					const cssLanguageService = languageServices.getCssLanguageService(textDocument.languageId);
					if (!cssLanguageService || !stylesheet) continue;
					const errs = cssLanguageService.doValidation(textDocument, stylesheet);
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
					result = result.concat(toSourceDiags(errs, uri, virtualStyles.sourceMaps.value));
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
				if (
					virtualScriptGen.textDocument.value
					&& !tsLanguageService.__internal__.getTextDocument2(virtualScriptGen.textDocument.value.uri)
				) {
					for (const script of [descriptor.script, descriptor.scriptSetup]) {
						if (!script) continue;
						diags.push(Diagnostic.create(
							{
								start: vueDoc.value.positionAt(script.loc.start),
								end: vueDoc.value.positionAt(script.loc.end),
							},
							'services are not working for this script block because virtual file is not found in TS server, maybe try to add lang="ts" to <script> or add `"allowJs": true` to tsconfig.json',
							DiagnosticSeverity.Warning,
							undefined,
							'volar',
						))
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
					tsProjectVersion.value;
				}
				const doc = document.value;
				if (!doc) return [];
				if (mode === 1) {
					return tsLanguageService.doValidation(doc.uri, { semantic: true });
				}
				else if (mode === 2) {
					return tsLanguageService.doValidation(doc.uri, { syntactic: true });
				}
				else if (mode === 3) {
					return tsLanguageService.doValidation(doc.uri, { suggestion: true });
				}
				else if (mode === 4) {
					return tsLanguageService.doValidation(doc.uri, { declaration: true });
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
				let result = toTsSourceDiags(errors_cache.value, doc.uri, tsSourceMaps.value);
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
					tsProjectVersion.value;
				}
				const doc = virtualTemplateGen.textDocument.value;
				if (!doc) return [];
				if (mode === 1) {
					return tsLanguageService.doValidation(doc.uri, { semantic: true });
				}
				else if (mode === 2) {
					return tsLanguageService.doValidation(doc.uri, { syntactic: true });
				}
				else if (mode === 3) {
					return tsLanguageService.doValidation(doc.uri, { suggestion: true });
				}
				else if (mode === 4) {
					return tsLanguageService.doValidation(doc.uri, { declaration: true });
				}
				return [];
			});
			const errors_2 = computed(() => {
				const result: Diagnostic[] = [];
				if (!virtualTemplateGen.textDocument.value
					|| !virtualTemplateGen.teleportSourceMap.value
					|| !virtualScriptGen.textDocument.value
				) return result;
				for (const diag of errors_1.value) {
					const spanText = virtualTemplateGen.textDocument.value.getText(diag.range);
					if (!templateScriptData.setupReturns.includes(spanText)) continue;
					const propRights = virtualTemplateGen.teleportSourceMap.value.getMappedRanges(diag.range.start, diag.range.end);
					for (const propRight of propRights) {
						if (propRight.data.isAdditionalReference) continue;
						const definitions = tsLanguageService.findDefinition(virtualTemplateGen.textDocument.value.uri, propRight.start);
						for (const definition of definitions) {
							if (definition.targetUri !== virtualScriptGen.textDocument.value.uri) continue;
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
				const result_1 = virtualTemplateGen.textDocument.value ? toTsSourceDiags(
					errors_1_cache.value,
					virtualTemplateGen.textDocument.value.uri,
					tsSourceMaps.value,
				) : [];
				const result_2 = virtualScriptGen.textDocument.value ? toTsSourceDiags(
					errors_2_cache.value,
					virtualScriptGen.textDocument.value.uri,
					tsSourceMaps.value,
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
		function toTsSourceDiags(errors: Diagnostic[], virtualScriptUri: string, sourceMaps: TsSourceMap[]) {
			const result: Diagnostic[] = [];
			for (const error of errors) {
				let found = false;
				for (const sourceMap of sourceMaps) {
					if (sourceMap.mappedDocument.uri !== virtualScriptUri)
						continue;
					const vueRange = sourceMap.getSourceRange(error.range.start, error.range.end);
					if (!vueRange || !vueRange.data.capabilities.diagnostic)
						continue;
					result.push({
						...error,
						range: vueRange,
					});
					found = true;
				}
				if (!found) { // patching for ref sugar
					for (const sourceMap of sourceMaps) {
						if (sourceMap.mappedDocument.uri !== virtualScriptUri)
							continue;
						const vueStartRange = sourceMap.getSourceRange(error.range.start);
						if (!vueStartRange || !vueStartRange.data.capabilities.diagnostic)
							continue;
						const vueEndRange = sourceMap.getSourceRange(error.range.end);
						if (!vueEndRange || !vueEndRange.data.capabilities.diagnostic)
							continue;
						result.push({
							...error,
							range: {
								start: vueStartRange.start,
								end: vueEndRange.start,
							},
						});
					}
				}
			}
			return result;
		}
	}
	function useComponentCompletionData() {
		const result = computed(() => {
			{ // watching
				tsProjectVersion.value;
			}
			const data = new Map<string, { item: CompletionItem | undefined, bind: CompletionItem[], on: CompletionItem[], slot: CompletionItem[] }>();
			if (virtualTemplateGen.textDocument.value && virtualTemplateRaw.textDocument.value) {
				const doc = virtualTemplateGen.textDocument.value;
				const text = doc.getText();
				for (const tag of [...templateScriptData.componentItems, ...templateScriptData.htmlElementItems]) {
					const tagName = tag.data.name;
					let bind: CompletionItem[] = [];
					let on: CompletionItem[] = [];
					let slot: CompletionItem[] = [];
					{
						const searchText = `__VLS_componentPropsBase['${tagName}']['`;
						let offset = text.indexOf(searchText);
						if (offset >= 0) {
							offset += searchText.length;
							bind = tsLanguageService.doComplete(doc.uri, doc.positionAt(offset));
						}
					}
					{
						const searchText = `__VLS_componentEmits['${tagName}']('`;
						let offset = text.indexOf(searchText);
						if (offset >= 0) {
							offset += searchText.length;
							on = tsLanguageService.doComplete(doc.uri, doc.positionAt(offset));
						}
					}
					{
						const searchText = `__VLS_components_0['${tagName}'].__VLS_slots['`;
						let offset = text.indexOf(searchText);
						if (offset >= 0) {
							offset += searchText.length;
							slot = tsLanguageService.doComplete(doc.uri, doc.positionAt(offset));
						}
					}
					data.set(tagName, { item: tag, bind, on, slot });
				}
				const globalBind = tsLanguageService.doComplete(doc.uri, doc.positionAt(doc.getText().indexOf(SearchTexts.GlobalAttrs)));
				data.set('*', { item: undefined, bind: globalBind, on: [], slot: [] });
			}
			return data;
		});
		return () => {
			tsProjectVersion.value = tsLanguageService.__internal__.host.getProjectVersion?.();
			return result.value;
		};
	}
	function untrack<T extends (...args: any[]) => any>(source: T) {
		return ((...args: any[]) => {
			pauseTracking();
			const result = source(...args);
			resetTracking();
			return result;
		}) as T;
	}
}
