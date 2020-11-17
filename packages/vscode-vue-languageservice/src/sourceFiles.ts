import {
	Diagnostic,
	DiagnosticSeverity,
	Position,
	CompletionItem,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createHtmlPugMapper, pugToHtml } from '@volar/pug';
import { uriToFsPath, sleep, notEmpty } from '@volar/shared';
import { SourceMap, TsSourceMap } from './utils/sourceMaps';
import type * as ts2 from '@volar/vscode-typescript-languageservice';
import * as vueSfc from '@vue/compiler-sfc';
import * as css from 'vscode-css-languageservice';
import { ref, computed, reactive, pauseTracking, resetTracking, Ref } from '@vue/reactivity';
import { hyphenate } from '@vue/shared';
import * as globalServices from './globalServices';
import * as prettyhtml from '@starptech/prettyhtml';
import { IDescriptor, ITemplateScriptData } from './types';
import { SearchTexts } from './virtuals/common';
import { useScriptSetupGen } from './virtuals/script';
import { useScriptSetupFormat } from './virtuals/scriptSetup.raw';
import { useScriptMain } from './virtuals/main';
import { useTemplateRaw } from './virtuals/template.raw';
import { useTemplateScript } from './virtuals/template';
import { useStylesRaw } from './virtuals/styles.raw';

export type SourceFile = ReturnType<typeof createSourceFile>;

export function createSourceFile(initialDocument: TextDocument, globalEls: Ref<CompletionItem[]>, globalBind: Ref<CompletionItem[]>, tsLanguageService: ts2.LanguageService) {
	// sources
	const tsProjectVersion = ref<string>();
	const vueDoc = ref(initialDocument);
	const vueUri = vueDoc.value.uri;
	const vueFileName = uriToFsPath(vueDoc.value.uri);
	const descriptor = reactive<IDescriptor>({
		template: null,
		script: null,
		scriptSetup: null,
		styles: [],
	});
	const templateScriptData = reactive<ITemplateScriptData>({
		projectVersion: undefined,
		context: [],
		components: [],
		props: [],
		setupReturns: [],
		scriptSetupExports: [],
		htmlElements: [],
	});
	const pugData = computed(() => {
		if (descriptor.template?.lang === 'pug') {
			try {
				const html = pugToHtml(descriptor.template.content);
				const mapper = createHtmlPugMapper(descriptor.template.content, html);
				return {
					html,
					mapper,
				};
			}
			catch (err) {
				const line: number = err.line - 1;
				const column: number = err.column - 1;
				const diagnostic: Diagnostic = {
					range: {
						start: Position.create(line, column),
						end: Position.create(line, column),
					},
					severity: DiagnosticSeverity.Error,
					code: err.code,
					source: 'pug',
					message: err.msg,
				};
				return {
					error: diagnostic
				};
			}
		}
		return {};
	});
	const templateScriptDocument = ref<TextDocument>();
	const vueHtmlDocument = computed(() => {
		return globalServices.html.parseHTMLDocument(vueDoc.value);
	});

	// virtual scripts
	const virtualStyles = useStylesRaw(tsLanguageService, untrack(() => vueDoc.value), computed(() => descriptor.styles));
	const virtualTemplateRaw = useTemplateRaw(untrack(() => vueDoc.value), computed(() => descriptor.template), pugData);
	const virtualTemplateGen = useTemplateScript(
		untrack(() => vueDoc.value),
		computed(() => descriptor.template),
		computed(() => descriptor.scriptSetup),
		templateScriptData, virtualStyles.textDocuments,
		virtualStyles.sourceMaps,
		pugData,
	);
	const virtualScriptGen = useScriptSetupGen(untrack(() => vueDoc.value), computed(() => descriptor.script), computed(() => descriptor.scriptSetup));
	const virtualScriptSetupRaw = useScriptSetupFormat(untrack(() => vueDoc.value), computed(() => descriptor.scriptSetup));
	const virtualScriptMain = useScriptMain(untrack(() => vueDoc.value), computed(() => descriptor.script), computed(() => descriptor.scriptSetup), computed(() => descriptor.template));

	// source map sets
	const tsSourceMaps = computed(() => {
		return [
			virtualScriptGen.sourceMap.value,
			virtualScriptSetupRaw.sourceMap.value,
			virtualScriptMain.sourceMap.value,
			virtualTemplateGen.sourceMap.value,
		].filter(notEmpty);
	});

	const tsDocuments = computed(() => {
		const docs = new Map<string, TextDocument>();
		if (virtualScriptGen.textDocument.value)
			docs.set(virtualScriptGen.textDocument.value.uri, virtualScriptGen.textDocument.value);
		if (virtualScriptSetupRaw.textDocument.value)
			docs.set(virtualScriptSetupRaw.textDocument.value.uri, virtualScriptSetupRaw.textDocument.value);
		if (virtualScriptMain.textDocument.value)
			docs.set(virtualScriptMain.textDocument.value.uri, virtualScriptMain.textDocument.value);

		if (templateScriptDocument.value) docs.set(templateScriptDocument.value.uri, templateScriptDocument.value);
		return docs;
	});

	update(initialDocument);

	return {
		uri: vueUri,
		fileName: vueFileName,
		getTextDocument: untrack(() => vueDoc.value),
		update,
		updateTemplateScript,
		getComponentCompletionData: useComponentCompletionData(),
		getDiagnostics: useDiagnostics(),
		getTsSourceMaps: untrack(() => tsSourceMaps.value),
		getCssSourceMaps: untrack(() => virtualStyles.sourceMaps.value),
		getHtmlSourceMaps: untrack(() => virtualTemplateRaw.htmlSourceMap.value ? [virtualTemplateRaw.htmlSourceMap.value] : []),
		getPugSourceMaps: untrack(() => virtualTemplateRaw.pugSourceMap.value ? [virtualTemplateRaw.pugSourceMap.value] : []),
		getTemplateScriptData: untrack(() => templateScriptData),
		getMirrorsSourceMaps: untrack(() => {
			return {
				contextSourceMap: virtualTemplateGen.contextSourceMap.value,
				componentSourceMap: virtualTemplateGen.componentSourceMap.value,
				scriptSetupSourceMap: virtualScriptGen.mirrorsSourceMap.value,
			};
		}),
		getDescriptor: untrack(() => descriptor),
		getVueHtmlDocument: untrack(() => vueHtmlDocument.value),
		getTsDocuments: untrack(() => tsDocuments.value),
		getVirtualScript: untrack(() => ({
			document: virtualScriptGen.textDocument.value,
			sourceMap: virtualScriptGen.sourceMap.value,
		})),
		getScriptSetupData: untrack(() => virtualScriptGen.genResult.value),
	};

	function update(newVueDocument: TextDocument) {
		const newDescriptor = vueSfc.parse(newVueDocument.getText(), { filename: vueFileName }).descriptor;
		const versionsBeforeUpdate = [
			virtualScriptGen.textDocument.value?.version,
			templateScriptDocument.value?.version,
		];

		updateTemplate(newDescriptor);
		updateScript(newDescriptor);
		updateScriptSetup(newDescriptor);
		updateStyles(newDescriptor);
		updateTemplateScriptDocument();

		if (newVueDocument.getText() !== vueDoc.value.getText()) {
			vueDoc.value = newVueDocument;
		}

		const versionsAfterUpdate = [
			virtualScriptGen.textDocument.value?.version,
			templateScriptDocument.value?.version,
		];

		return {
			scriptUpdated: versionsBeforeUpdate[0] !== versionsAfterUpdate[0],
			templateScriptUpdated: versionsBeforeUpdate[1] !== versionsAfterUpdate[1],
		};

		function updateTemplate(newDescriptor: vueSfc.SFCDescriptor) {
			const newData = newDescriptor.template ? {
				lang: newDescriptor.template.lang ?? 'html',
				content: newDescriptor.template.content,
				loc: {
					start: newDescriptor.template.loc.start.offset,
					end: newDescriptor.template.loc.end.offset,
				},
			} : null;
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
				lang: newDescriptor.script.lang ?? 'js',
				content: newDescriptor.script.content,
				loc: {
					start: newDescriptor.script.loc.start.offset,
					end: newDescriptor.script.loc.end.offset,
				},
			} : null;
			if (descriptor.script && newData) {
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
				setup: typeof newDescriptor.scriptSetup.setup === 'string' ? newDescriptor.scriptSetup.setup : '',
			} : null;
			if (descriptor.scriptSetup && newData) {
				descriptor.scriptSetup.lang = newData.lang;
				descriptor.scriptSetup.content = newData.content;
				descriptor.scriptSetup.loc.start = newData.loc.start;
				descriptor.scriptSetup.loc.end = newData.loc.end;
				descriptor.scriptSetup.setup = newData.setup;
			}
			else {
				descriptor.scriptSetup = newData;
			}
		}
		function updateStyles(newDescriptor: vueSfc.SFCDescriptor) {
			for (let i = 0; i < newDescriptor.styles.length; i++) {
				const style = newDescriptor.styles[i];
				const newData = {
					lang: style.lang ?? 'css',
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
	}
	function updateTemplateScript() {
		if (templateScriptData.projectVersion === tsLanguageService.host.getProjectVersion?.()) {
			return false;
		}
		templateScriptData.projectVersion = tsLanguageService.host.getProjectVersion?.();

		const doc = virtualScriptMain.textDocument.value;
		const docText = doc.getText();
		const context = docText.indexOf(SearchTexts.Context) >= 0 ? tsLanguageService.doComplete(doc, doc.positionAt(docText.indexOf(SearchTexts.Context))) : [];
		const components = docText.indexOf(SearchTexts.Components) >= 0 ? tsLanguageService.doComplete(doc, doc.positionAt(docText.indexOf(SearchTexts.Components))) : [];
		const props = docText.indexOf(SearchTexts.Props) >= 0 ? tsLanguageService.doComplete(doc, doc.positionAt(docText.indexOf(SearchTexts.Props))) : [];
		const setupReturns = docText.indexOf(SearchTexts.SetupReturns) >= 0 ? tsLanguageService.doComplete(doc, doc.positionAt(docText.indexOf(SearchTexts.SetupReturns))) : [];
		const scriptSetupExports = docText.indexOf(SearchTexts.ScriptSetupExports) >= 0 ? tsLanguageService.doComplete(doc, doc.positionAt(docText.indexOf(SearchTexts.ScriptSetupExports))) : [];

		const contextNames = context.map(entry => entry.data.name);
		const componentNames = components.map(entry => entry.data.name);
		const propNames = props.map(entry => entry.data.name);
		const setupReturnNames = setupReturns.map(entry => entry.data.name);
		const scriptSetupExportNames = scriptSetupExports.map(entry => entry.data.name);
		const htmlElementNames = globalEls.value.map(entry => entry.data.name);

		if (eqSet(new Set(contextNames), new Set(templateScriptData.context))
			&& eqSet(new Set(componentNames), new Set(templateScriptData.components))
			&& eqSet(new Set(propNames), new Set(templateScriptData.props))
			&& eqSet(new Set(setupReturnNames), new Set(templateScriptData.setupReturns))
			&& eqSet(new Set(scriptSetupExportNames), new Set(templateScriptData.scriptSetupExports))
			&& eqSet(new Set(htmlElementNames), new Set(templateScriptData.htmlElements))
		) {
			return false;
		}

		templateScriptData.context = contextNames;
		templateScriptData.components = componentNames;
		templateScriptData.props = propNames;
		templateScriptData.setupReturns = setupReturnNames;
		templateScriptData.scriptSetupExports = scriptSetupExportNames;
		templateScriptData.htmlElements = htmlElementNames;
		updateTemplateScriptDocument();
		return true;

		function eqSet<T>(as: Set<T>, bs: Set<T>) {
			if (as.size !== bs.size) return false;
			for (const a of as) if (!bs.has(a)) return false;
			return true;
		}
	}
	function updateTemplateScriptDocument() {
		const doc = virtualTemplateGen.textDocument.value;
		if (!doc) {
			templateScriptDocument.value = undefined;
		}
		else if (doc.getText() !== templateScriptDocument.value?.getText()) {
			templateScriptDocument.value = doc;
		}
	}
	function useDiagnostics() {

		let version = 0;

		const stylesDiags = [useStylesValidation(), ref<Diagnostic[]>([])];
		const templateDiags = [useTemplateValidation(), ref<Diagnostic[]>([])];
		const templateScriptDiags_1 = [useTemplateScriptValidation(1), ref<Diagnostic[]>([])];
		const templateScriptDiags_2 = [useTemplateScriptValidation(2), ref<Diagnostic[]>([])];
		const templateScriptDiags_3 = [useTemplateScriptValidation(3), ref<Diagnostic[]>([])];
		const scriptSetupDiags_1 = [useScriptValidation(virtualScriptGen.textDocument, 1), ref<Diagnostic[]>([])];
		const scriptSetupDiags_2 = [useScriptValidation(virtualScriptGen.textDocument, 2), ref<Diagnostic[]>([])];
		const scriptSetupDiags_3 = [useScriptValidation(virtualScriptGen.textDocument, 3), ref<Diagnostic[]>([])];

		const all = [
			stylesDiags,
			templateDiags,

			templateScriptDiags_2,
			scriptSetupDiags_2,

			templateScriptDiags_3,
			scriptSetupDiags_3,

			templateScriptDiags_1,
			scriptSetupDiags_1,
		];

		const allLast = computed(() => {
			return all.map(diag => diag[1].value).flat();
		});

		return worker;

		async function worker(isCancel?: () => boolean, onDirty?: (diags: Diagnostic[]) => void) {
			tsProjectVersion.value = tsLanguageService.host.getProjectVersion?.();
			let dirty = false;

			for (const diag of all) {
				if (dirty) await sleep();
				if (isCancel?.()) return;
				dirty = tryProgress(diag[0], diag[1]);
			}

			return allLast.value;

			function tryProgress(data: Ref<Diagnostic[]>, lastData: Ref<Diagnostic[]>) {
				const oldVersion = version;
				lastData.value = data.value;
				if (version !== oldVersion) {
					onDirty?.(allLast.value);
					return true;
				}
				return false;
			}
		}
		function useTemplateValidation() {
			const htmlErrors = computed(() => {
				if (virtualTemplateRaw.textDocument.value?.languageId === 'html') {
					return getVueCompileErrors(virtualTemplateRaw.textDocument.value);
				}
				return [];
			});
			const pugErrors = computed(() => {
				const result: Diagnostic[] = [];
				if (pugData.value.error) {
					result.push(pugData.value.error);
				}
				if (pugData.value.html && virtualTemplateRaw.textDocument.value) {
					const htmlDoc = TextDocument.create('', 'html', 0, pugData.value.html);
					const vueCompileErrors = getVueCompileErrors(htmlDoc);
					const pugDocRange = {
						start: virtualTemplateRaw.textDocument.value.positionAt(0),
						end: virtualTemplateRaw.textDocument.value.positionAt(virtualTemplateRaw.textDocument.value.getText().length),
					};
					// TODO
					for (const vueCompileError of vueCompileErrors) {
						let errorText = htmlDoc.getText(vueCompileError.range);
						errorText = prettyhtml(errorText).contents;
						vueCompileError.range = pugDocRange;
						vueCompileError.message += '\n```html\n' + errorText + '```';
						result.push(vueCompileError);
					}
				}
				return result;
			});
			return computed(() => {
				version++;
				if (!virtualTemplateRaw.textDocument.value) return [];
				return [
					...toSourceDiags(htmlErrors.value, virtualTemplateRaw.textDocument.value.uri, virtualTemplateRaw.htmlSourceMap.value ? [virtualTemplateRaw.htmlSourceMap.value] : []),
					...toSourceDiags(pugErrors.value, virtualTemplateRaw.textDocument.value.uri, virtualTemplateRaw.pugSourceMap.value ? [virtualTemplateRaw.pugSourceMap.value] : []),
				];
			});

			function getVueCompileErrors(doc: TextDocument) {
				const result: Diagnostic[] = [];
				try {
					const templateResult = vueSfc.compileTemplate({
						source: doc.getText(),
						filename: vueFileName,
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
		function useStylesValidation() {
			const errors = computed(() => {
				let result = new Map<string, css.Diagnostic[]>();
				for (const { textDocument, stylesheet } of virtualStyles.textDocuments.value) {
					const cssLanguageService = textDocument.languageId === "scss" ? globalServices.scss : globalServices.css;
					const errs = cssLanguageService.doValidation(textDocument, stylesheet);
					if (errs) result.set(textDocument.uri, errs);
				}
				return result;
			});
			return computed(() => {
				version++;
				let result: css.Diagnostic[] = [];
				for (const [uri, errs] of errors.value) {
					result = result.concat(toSourceDiags(errs, uri, virtualStyles.sourceMaps.value));
				}
				return result as Diagnostic[];
			});
		}
		function useScriptValidation(document: Ref<TextDocument | undefined>, mode: number) {
			const errors = computed(() => {
				if (mode === 1) { // watching
					tsProjectVersion.value;
				}
				const doc = document.value;
				if (!doc) return [];
				if (mode === 1) {
					return tsLanguageService.doValidation(doc, { semantic: true });
				}
				else if (mode === 2) {
					return tsLanguageService.doValidation(doc, { syntactic: true });
				}
				else {
					return tsLanguageService.doValidation(doc, { suggestion: true });
				}
			});
			return computed(() => {
				version++;
				const doc = document.value;
				if (!doc) return [];
				return toTsSourceDiags(errors.value, doc.uri, tsSourceMaps.value);
			});
		}
		function useTemplateScriptValidation(mode: number) {
			const errors_1 = computed(() => {
				if (mode === 1) { // watching
					tsProjectVersion.value;
				}
				const doc = templateScriptDocument.value;
				if (!doc) return [];
				if (mode === 1) {
					return tsLanguageService.doValidation(doc, { semantic: true });
				}
				else if (mode === 2) {
					return tsLanguageService.doValidation(doc, { syntactic: true });
				}
				else {
					return tsLanguageService.doValidation(doc, { suggestion: true });
				}
			});
			const errors_2 = computed(() => {
				const result: Diagnostic[] = [];
				if (!virtualTemplateGen.textDocument.value
					|| !virtualTemplateGen.contextSourceMap.value
					|| !virtualScriptGen.textDocument.value)
					return result;
				for (const diag of errors_1.value) {
					const spanText = virtualTemplateGen.textDocument.value.getText(diag.range);
					if (!templateScriptData.setupReturns.includes(spanText)) continue;
					const propRights = virtualTemplateGen.contextSourceMap.value.sourceToTargets(diag.range);
					for (const propRight of propRights) {
						if (propRight.maped.data.isAdditionalReference) continue;
						const definitions = tsLanguageService.findDefinition(virtualTemplateGen.textDocument.value, propRight.range.start);
						for (const definition of definitions) {
							if (definition.uri !== virtualScriptGen.textDocument.value.uri) continue;
							result.push({
								...diag,
								range: definition.range,
							});
						}
					}
				}
				return result;
			})
			return computed(() => {
				version++;
				const result_1 = templateScriptDocument.value ? toTsSourceDiags(
					errors_1.value,
					templateScriptDocument.value.uri,
					tsSourceMaps.value,
				) : [];
				const result_2 = virtualScriptGen.textDocument.value ? toTsSourceDiags(
					errors_2.value,
					virtualScriptGen.textDocument.value.uri,
					tsSourceMaps.value,
				) : [];
				return [...result_1, ...result_2];
			});
		}
		function toSourceDiags<T = Diagnostic | css.Diagnostic>(errors: T[], virtualScriptUri: string, sourceMaps: SourceMap[]) {
			const result: T[] = [];
			for (const error of errors) {
				for (const sourceMap of sourceMaps) {
					if (sourceMap.targetDocument.uri === virtualScriptUri) {
						if (css.Diagnostic.is(error) || Diagnostic.is(error)) {
							const vueLoc = sourceMap.targetToSource(error.range);
							if (vueLoc) {
								result.push({
									...error,
									range: vueLoc.range,
								});
							}
						}
					}
				}
			}
			return result;
		}
		function toTsSourceDiags(errors: Diagnostic[], virtualScriptUri: string, sourceMaps: TsSourceMap[]) {
			const result: Diagnostic[] = [];
			for (const error of errors) {
				for (const sourceMap of sourceMaps) {
					if (sourceMap.targetDocument.uri === virtualScriptUri) {
						if (css.Diagnostic.is(error) || Diagnostic.is(error)) {
							const vueLoc = sourceMap.targetToSource(error.range);
							if (vueLoc && vueLoc.maped.data.capabilities.diagnostic) {
								result.push({
									...error,
									range: vueLoc.range,
								});
							}
						}
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
			const data = new Map<string, { bind: CompletionItem[], on: CompletionItem[] }>();
			if (templateScriptDocument.value && virtualTemplateRaw.textDocument.value) {
				const doc = templateScriptDocument.value;
				const text = doc.getText();
				for (const tagName of [...templateScriptData.components, ...templateScriptData.htmlElements, ...templateScriptData.context]) {
					let bind: CompletionItem[] = [];
					let on: CompletionItem[] = [];
					{
						const searchText = `__VLS_componentPropsBase['${tagName}']['`;
						let offset = text.indexOf(searchText);
						if (offset >= 0) {
							offset += searchText.length;
							bind = tsLanguageService.doComplete(doc, doc.positionAt(offset));
						}
					}
					{
						const searchText = `__VLS_componentEmits['${tagName}']['`;
						let offset = text.indexOf(searchText);
						if (offset >= 0) {
							offset += searchText.length;
							on = tsLanguageService.doComplete(doc, doc.positionAt(offset));
						}
					}
					data.set(tagName, { bind, on });
					data.set(hyphenate(tagName), { bind, on });
				}
				data.set('*', { bind: globalBind.value, on: [] });
			}
			return data;
		});
		return () => {
			tsProjectVersion.value = tsLanguageService.host.getProjectVersion?.();
			return result.value;
		};
	}
	function untrack<T>(source: () => T) {
		return () => {
			pauseTracking();
			const result = source();
			resetTracking();
			return result;
		};
	}
}
