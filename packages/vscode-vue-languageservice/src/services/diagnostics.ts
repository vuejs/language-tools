import * as shared from '@volar/shared';
import * as vueSfc from '@vue/compiler-sfc';
import { computed, ComputedRef, ref, Ref } from '@vue/reactivity';
import type * as css from 'vscode-css-languageservice';
import type * as json from 'vscode-json-languageservice';
import * as vscode from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { SourceFile } from '../sourceFile';
import type { ApiLanguageServiceContext } from '../types';
import * as dedupe from '../utils/dedupe';
import { SourceMap, TsSourceMap } from '../utils/sourceMaps';
import { untrack } from '../utils/untrack';

export function register({ sourceFiles, getCssLs, jsonLs, templateTsLs, scriptTsLs }: ApiLanguageServiceContext) {

	const workers = new WeakMap<SourceFile, ReturnType<typeof useDiagnostics>>();

	return async (uri: string, response: (result: vscode.Diagnostic[]) => void, isCancel?: () => Promise<boolean>) => {
		const sourceFile = sourceFiles.get(uri);
		let worker = workers.get(sourceFile);
		if (!worker) {
			worker = untrack(useDiagnostics(sourceFile));
			workers.set(sourceFile, worker);
		}
		worker(response, isCancel);
	};

	function useDiagnostics(sourceFile: SourceFile) {

		const {
			cssLsDocuments,
			cssLsSourceMaps,
			sfcJsons,
			sfcScriptForScriptLs,
			lastUpdated,
			sfcErrors,
			sfcTemplate,
			descriptor,
			document,
			sfcTemplateScript,
			templateScriptData,
			sfcScriptForTemplateLs,
			templateLsSourceMaps,
		} = sourceFile.refs;

		const templateTsProjectVersion = ref<string>();
		const scriptTsProjectVersion = ref<string>();

		const tsOptions = templateTsLs.__internal__.host.getCompilationSettings();
		const anyNoUnusedEnabled = tsOptions.noUnusedLocals || tsOptions.noUnusedParameters;

		const nonTs: [{
			result: ComputedRef<Promise<vscode.Diagnostic[]> | vscode.Diagnostic[]>;
			cache: ComputedRef<Promise<vscode.Diagnostic[]> | vscode.Diagnostic[]>;
		}, number, vscode.Diagnostic[]][] = [
				[useStylesValidation(computed(() => cssLsDocuments.value)), 0, []],
				[useJsonsValidation(computed(() => sfcJsons.textDocuments.value)), 0, []],
				[useTemplateValidation(), 0, []],
				[useScriptExistValidation(), 0, []],
			];
		let templateTs: [{
			result: ComputedRef<vscode.Diagnostic[]>;
			cache: ComputedRef<vscode.Diagnostic[]>;
		}, number, vscode.Diagnostic[]][] = [
				[useTemplateScriptValidation(1), 0, []],
				[useTemplateScriptValidation(2), 0, []],
				[useTemplateScriptValidation(3), 0, []],
			];
		let scriptTs: [{
			result: ComputedRef<vscode.Diagnostic[]>;
			cache: ComputedRef<vscode.Diagnostic[]>;
		}, number, vscode.Diagnostic[]][] = [
				[useScriptValidation(sfcScriptForScriptLs.textDocument, 1), 0, []],
				[useScriptValidation(sfcScriptForScriptLs.textDocument, 2), 0, []],
				[useScriptValidation(computed(() => sfcScriptForScriptLs.textDocumentForSuggestion.value ?? sfcScriptForScriptLs.textDocument.value), 3), 0, []],
				// [useScriptValidation(virtualScriptGen.textDocument, 4), 0, []], // TODO: support cancel because it's very slow
				[useScriptValidation(computed(() => anyNoUnusedEnabled ? sfcScriptForScriptLs.textDocumentForSuggestion.value : undefined), 1, true), 0, []],
			];

		return async (response: (diags: vscode.Diagnostic[]) => void, isCancel?: () => Promise<boolean>) => {

			templateTsProjectVersion.value = templateTsLs.__internal__.host.getProjectVersion?.();
			scriptTsProjectVersion.value = scriptTsLs.__internal__.host.getProjectVersion?.();

			// sort by cost
			templateTs = templateTs.sort((a, b) => a[1] - b[1]);
			scriptTs = scriptTs.sort((a, b) => a[1] - b[1]);

			let all = [...nonTs];
			let mainTsErrorStart = all.length - 1;
			let mainTsErrorEnd = -1;

			const isScriptChanged = lastUpdated.script || lastUpdated.scriptSetup;
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

			function isErrorsDirty(oldErrors: vscode.Diagnostic[], newErrors: vscode.Diagnostic[]) {
				return !shared.eqSet(errorsToKeys(oldErrors), errorsToKeys(newErrors));
			}
			function errorsToKeys(errors: vscode.Diagnostic[]) {
				return new Set(errors.map(error =>
					error.source
					+ ':' + error.code
					+ ':' + error.message
				));
			}
		}

		function useTemplateValidation() {
			const htmlErrors = computed(() => {
				if (sfcTemplate.textDocument.value && sfcTemplate.htmlDocument.value) {
					return getVueCompileErrors(sfcTemplate.textDocument.value);
				}
				return [];
			});
			const pugErrors = computed(() => {
				const result: vscode.Diagnostic[] = [];
				if (sfcTemplate.textDocument.value && sfcTemplate.pugDocument.value) {
					const pugDoc = sfcTemplate.pugDocument.value;
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
							let pugRange: vscode.Range | undefined = pugDoc.sourceMap.getSourceRange(vueCompileError.range.start, vueCompileError.range.end);
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
									errorText += '\n```html\n' + htmlText.trim() + '\n```'; // may thorw
								} catch (error) {
									errorText += '\n```html\n' + htmlText.trim() + '\n```'; // may thorw
									errorText += '\n```json\n' + JSON.stringify(error, null, 2) + '\n```';
								}
								vueCompileError.message += errorText;
								vueCompileError.range = {
									start: sfcTemplate.textDocument.value.positionAt(0),
									end: sfcTemplate.textDocument.value.positionAt(sfcTemplate.textDocument.value.getText().length),
								};
								result.push(vueCompileError);
							}
						}
					}
				}
				return result;
			});
			const htmlErrors_cache = ref<vscode.Diagnostic[]>([]);
			const pugErrors_cache = ref<vscode.Diagnostic[]>([]);
			const result = computed(() => {
				htmlErrors_cache.value = htmlErrors.value;
				pugErrors_cache.value = pugErrors.value;
				return cacheWithSourceMap.value;
			});
			const cacheWithSourceMap = computed(() => {
				if (!sfcTemplate.textDocument.value) return [];
				return [
					...toSourceDiags(htmlErrors.value, sfcTemplate.textDocument.value.uri, sfcTemplate.htmlSourceMap.value ? [sfcTemplate.htmlSourceMap.value] : []),
					...toSourceDiags(pugErrors.value, sfcTemplate.textDocument.value.uri, sfcTemplate.pugSourceMap.value ? [sfcTemplate.pugSourceMap.value] : []),
				];
			});
			return {
				result,
				cache: cacheWithSourceMap,
			};

			function getVueCompileErrors(doc: TextDocument) {
				const result: vscode.Diagnostic[] = [];
				try {
					const templateResult = vueSfc.compileTemplate({
						source: doc.getText(),
						filename: shared.uriToFsPath(sourceFile.uri),
						id: shared.uriToFsPath(sourceFile.uri),
						compilerOptions: {
							onError: err => {
								if (!err.loc) return;

								const diagnostic: vscode.Diagnostic = {
									range: {
										start: doc.positionAt(err.loc.start.offset),
										end: doc.positionAt(err.loc.end.offset),
									},
									severity: vscode.DiagnosticSeverity.Error,
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

						const diagnostic: vscode.Diagnostic = {
							range: {
								start: doc.positionAt(err.loc.start.offset),
								end: doc.positionAt(err.loc.end.offset),
							},
							severity: vscode.DiagnosticSeverity.Error,
							source: 'vue',
							code: err.code,
							message: err.message,
						};
						result.push(diagnostic);
					}
				}
				catch (err) {
					const diagnostic: vscode.Diagnostic = {
						range: {
							start: doc.positionAt(0),
							end: doc.positionAt(doc.getText().length),
						},
						severity: vscode.DiagnosticSeverity.Error,
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
				let result = new Map<string, vscode.Diagnostic[]>();
				for (const { textDocument, stylesheet } of documents.value) {
					const cssLs = getCssLs(textDocument.languageId);
					if (!cssLs || !stylesheet) continue;
					const errs = cssLs.doValidation(textDocument, stylesheet);
					if (errs) result.set(textDocument.uri, errs);
				}
				return result;
			});
			const errors_cache = ref<Map<string, vscode.Diagnostic[]>>(new Map());
			const result = computed(() => {
				errors_cache.value = errors.value;
				return cacheWithSourceMap.value;
			});
			const cacheWithSourceMap = computed(() => {
				let result: vscode.Diagnostic[] = [];
				for (const [uri, errs] of errors_cache.value) {
					result = result.concat(toSourceDiags(errs, uri, cssLsSourceMaps.value));
				}
				return result as vscode.Diagnostic[];
			});
			return {
				result,
				cache: cacheWithSourceMap,
			};
		}
		function useJsonsValidation(documents: Ref<{ textDocument: TextDocument, jsonDocument: json.JSONDocument }[]>) {
			const errors = computed(async () => {
				let result = new Map<string, vscode.Diagnostic[]>();
				for (const { textDocument, jsonDocument } of documents.value) {
					const errs = await jsonLs.doValidation(textDocument, jsonDocument, textDocument.languageId === 'json'
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
			const errors_cache = ref<Promise<Map<string, vscode.Diagnostic[]>>>();
			const result = computed(() => {
				errors_cache.value = errors.value;
				return cacheWithSourceMap.value;
			});
			const cacheWithSourceMap = computed(async () => {
				let result: vscode.Diagnostic[] = [];
				if (errors_cache.value) {
					for (const [uri, errs] of await errors_cache.value) {
						result = result.concat(toSourceDiags(errs, uri, sfcJsons.sourceMaps.value));
					}
				}
				return result as vscode.Diagnostic[];
			});
			return {
				result,
				cache: cacheWithSourceMap,
			};
		}
		function useScriptExistValidation() {
			const scriptErrors = computed(() => {
				const diags: vscode.Diagnostic[] = [];
				if (!scriptTsLs.__internal__.getValidTextDocument(sfcScriptForScriptLs.textDocument.value.uri)) {
					for (const script of [descriptor.script, descriptor.scriptSetup]) {
						if (!script || script.content === '') continue;
						const error = vscode.Diagnostic.create(
							{
								start: document.value.positionAt(script.loc.start),
								end: document.value.positionAt(script.loc.end),
							},
							'Virtual script not found, may missing <script lang="ts"> / "allowJs": true / jsconfig.json.',
							vscode.DiagnosticSeverity.Information,
							undefined,
							'volar',
						);
						error.tags = [vscode.DiagnosticTag.Unnecessary];
						diags.push(error);
					}
				}
				return diags;
			});
			const templateErrors = computed(() => {
				const diags: vscode.Diagnostic[] = [];
				if (
					sfcTemplateScript.textDocument.value
					&& sfcTemplateScript.textDocumentForFormatting.value
					&& sfcTemplateScript.sourceMapForFormatting.value
					&& !templateTsLs.__internal__.getValidTextDocument(sfcTemplateScript.textDocument.value.uri)
				) {
					for (const maped of sfcTemplateScript.sourceMapForFormatting.value) {
						const error = vscode.Diagnostic.create(
							{
								start: document.value.positionAt(maped.sourceRange.start),
								end: document.value.positionAt(maped.sourceRange.end),
							},
							'Virtual script not found, may missing <script lang="ts"> / "allowJs": true / jsconfig.json.',
							vscode.DiagnosticSeverity.Information,
							undefined,
							'volar',
						);
						error.tags = [vscode.DiagnosticTag.Unnecessary];
						diags.push(error);
					}
				}
				return diags;
			});
			const errors = computed(() => [
				...scriptErrors.value,
				...templateErrors.value,
			]);
			return {
				result: errors,
				cache: errors,
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
			const errors_cache = ref<vscode.Diagnostic[]>([]);
			const result = computed(() => {
				errors_cache.value = errors.value;
				return cacheWithSourceMap.value;
			});
			const cacheWithSourceMap = computed(() => {
				const doc = document.value;
				if (!doc) return [];
				let result = toTsSourceDiags('script', errors_cache.value, doc.uri, templateLsSourceMaps.value);
				if (onlyUnusedCheck) {
					result = result.filter(error => error.tags?.includes(vscode.DiagnosticTag.Unnecessary));
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
				const doc = sfcTemplateScript.textDocument.value;
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
				const result: vscode.Diagnostic[] = [];
				if (!sfcTemplateScript.textDocument.value
					|| !sfcTemplateScript.teleportSourceMap.value
				) return result;
				for (const diag of errors_1.value) {
					const spanText = sfcTemplateScript.textDocument.value.getText(diag.range);
					if (!templateScriptData.setupReturns.includes(spanText)) continue;
					const propRights = sfcTemplateScript.teleportSourceMap.value.getMappedRanges(diag.range.start, diag.range.end);
					for (const propRight of propRights) {
						if (propRight.data.isAdditionalReference) continue;
						const definitions = templateTsLs.findDefinition(sfcTemplateScript.textDocument.value.uri, propRight.start);
						for (const definition of definitions) {
							if (definition.targetUri !== sfcScriptForTemplateLs.textDocument.value.uri) continue;
							result.push({
								...diag,
								range: definition.targetSelectionRange,
							});
						}
					}
				}
				return result;
			});
			const errors_1_cache = ref<vscode.Diagnostic[]>([]);
			const errors_2_cache = ref<vscode.Diagnostic[]>([]);
			const result = computed(() => {
				errors_1_cache.value = errors_1.value;
				errors_2_cache.value = errors_2.value;
				return cacheWithSourceMap.value;
			});
			const cacheWithSourceMap = computed(() => {
				const result_1 = sfcTemplateScript.textDocument.value ? toTsSourceDiags(
					'template',
					errors_1_cache.value,
					sfcTemplateScript.textDocument.value.uri,
					templateLsSourceMaps.value,
				) : [];
				const result_2 = sfcScriptForTemplateLs.textDocument.value ? toTsSourceDiags(
					'template',
					errors_2_cache.value,
					sfcScriptForTemplateLs.textDocument.value.uri,
					templateLsSourceMaps.value,
				) : [];
				return [...result_1, ...result_2];
			});
			return {
				result,
				cache: cacheWithSourceMap,
			};
		}
		function toSourceDiags<T = vscode.Diagnostic | vscode.Diagnostic>(errors: T[], virtualScriptUri: string, sourceMaps: SourceMap[]) {
			const result: T[] = [];
			for (const error of errors) {
				if (vscode.Diagnostic.is(error)) {
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
		function toTsSourceDiags(lsType: 'template' | 'script', errors: vscode.Diagnostic[], virtualScriptUri: string, sourceMaps: TsSourceMap[]) {
			const result: vscode.Diagnostic[] = [];
			for (const error of errors) {
				const vueRange = findVueRange(virtualScriptUri, error.range);
				if (vueRange) {
					const vueError: vscode.Diagnostic = {
						...error,
						range: vueRange,
					};
					if (vueError.relatedInformation) {
						const vueInfos: vscode.DiagnosticRelatedInformation[] = [];
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

			function findVueRange(virtualUri: string, virtualRange: vscode.Range) {
				for (const sourceMap of sourceMaps) {
					if (sourceMap.mappedDocument.uri === virtualUri) {

						const vueRange = sourceMap.getSourceRange(virtualRange.start, virtualRange.end);
						if (vueRange && vueRange.data.capabilities.diagnostic) {
							return {
								uri: sourceFile.uri,
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
									uri: sourceFile.uri,
									start: vueStartRange.start,
									end: vueEndRange.start,
								};
							}
						}
					}
				}
				for (const vueLoc of sourceFiles.fromTsLocation(lsType, virtualUri, virtualRange.start, virtualRange.end)) {
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
