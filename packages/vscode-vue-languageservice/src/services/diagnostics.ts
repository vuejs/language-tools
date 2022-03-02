import * as shared from '@volar/shared';
import { computed, ComputedRef, ref, Ref } from '@vue/reactivity';
import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { SourceFile, ScriptSourceMap, SourceMap } from '@volar/vue-typescript';
import type { LanguageServiceRuntimeContext } from '../types';
import * as dedupe from '../utils/dedupe';
import { untrack } from '../utils/untrack';

export function register({ sourceFiles, getCssLs, jsonLs, templateTsLs, scriptTsLs, vueHost, getTextDocument, getStylesheet, getJsonDocument, getPugDocument }: LanguageServiceRuntimeContext, updateTemplateScripts: () => void) {

	const vueWorkers = new WeakMap<SourceFile, ReturnType<typeof useDiagnostics>>();
	const tsWorkers = new Map<string, ReturnType<typeof useDiagnostics_ts>>();

	return async (uri: string, response?: (result: vscode.Diagnostic[]) => void, isCancel?: () => Promise<boolean>) => {

		const sourceFile = sourceFiles.get(uri);
		if (sourceFile) {

			let worker = vueWorkers.get(sourceFile);
			if (!worker) {
				worker = untrack(useDiagnostics(sourceFile));
				vueWorkers.set(sourceFile, worker);
			}

			return await worker(response, isCancel);
		}
		else {

			let worker = tsWorkers.get(uri);
			if (!worker) {
				worker = untrack(useDiagnostics_ts(uri));
				tsWorkers.set(uri, worker);
			}

			return await worker(response, isCancel);
		}
	};

	function useDiagnostics_ts(uri: string) {

		const scriptTsProjectVersion = ref<string>();
		const docVersion = ref<number>();

		let all: [ReturnType<typeof useScriptValidation>, number, vscode.Diagnostic[]][] = [
			[useScriptValidation(1), 0, []],
			[useScriptValidation(2), 0, []],
			[useScriptValidation(3), 0, []],
		];

		return async (response?: (diags: vscode.Diagnostic[]) => void, isCancel?: () => Promise<boolean>) => {

			scriptTsProjectVersion.value = scriptTsLs.__internal__.host.getProjectVersion?.();
			docVersion.value = getTextDocument(uri)?.version;

			// sort by cost
			all = all.sort((a, b) => a[1] - b[1]);

			let isDirty = false;
			let lastResponse: vscode.Diagnostic[] | undefined;

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
					.flat();
				const newErrors = (await Promise.all(_newErrors))
					.flat();
				const _oldErrors = all
					.slice(i + 1)
					.map(async diag => diag[2])
				const oldErrors = (await Promise.all(_oldErrors))
					.flat();
				const isLast = i === all.length - 1
				if (await isCancel?.()) return;
				if (isLast || isDirty) {
					isDirty = false;
					lastResponse = dedupe.withDiagnostics(newErrors.concat(oldErrors));
					response?.(lastResponse);
				}
			}

			return lastResponse;

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

		function useScriptValidation(mode: 1 | 2 | 3 | 4) {
			const errors: ComputedRef<vscode.Diagnostic[]> = computed(() => {
				{ // watching
					docVersion.value
					if (mode === 1) {
						scriptTsProjectVersion.value;
					}
				}
				if (mode === 1) {
					return scriptTsLs.doValidation(uri, { semantic: true });
				}
				else if (mode === 2) {
					return scriptTsLs.doValidation(uri, { syntactic: true });
				}
				else if (mode === 3) {
					return scriptTsLs.doValidation(uri, { suggestion: true });
				}
				else if (mode === 4) {
					return scriptTsLs.doValidation(uri, { declaration: true });
				}
				return [];
			});
			const errors_cache: Ref<vscode.Diagnostic[]> = ref([]);
			const result: ComputedRef<vscode.Diagnostic[]> = computed(() => {
				errors_cache.value = errors.value;
				return errors_cache.value;
			});
			return {
				result,
				cache: errors_cache,
			};
		}
	}
	function useDiagnostics(sourceFile: SourceFile) {

		const {
			cssLsDocuments,
			cssLsSourceMaps,
			sfcCustomBlocks,
			sfcScriptForScriptLs,
			lastUpdated,
			sfcTemplate,
			descriptor,
			document,
			sfcTemplateScript,
			sfcTemplateData,
			sfcTemplateCompileResult,
			templateScriptData,
			sfcScriptForTemplateLs,
			templateLsSourceMaps,
			scriptSetupRanges
		} = sourceFile.refs;

		const templateTsProjectVersion = ref<string>();
		const scriptTsProjectVersion = ref<string>();

		const nonTs: [{
			result: ComputedRef<Promise<vscode.Diagnostic[]> | vscode.Diagnostic[]>;
			cache: ComputedRef<Promise<vscode.Diagnostic[]> | vscode.Diagnostic[]>;
		}, number, vscode.Diagnostic[]][] = [
				[useScriptSetupWarnings(), 0, []],
				[useStylesValidation(computed(() => cssLsDocuments.value)), 0, []],
				[useJsonsValidation(computed(() => sfcCustomBlocks.textDocuments.value)), 0, []],
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
				[useScriptValidation(sfcScriptForScriptLs.textDocument, 3), 0, []],
				// [useScriptValidation(virtualScriptGen.textDocument, 4), 0, []], // TODO: support cancel because it's very slow
			];

		return async (response?: (diags: vscode.Diagnostic[]) => void, isCancel?: () => Promise<boolean>) => {

			templateTsProjectVersion.value = templateTsLs.__internal__.host.getProjectVersion?.();
			scriptTsProjectVersion.value = scriptTsLs.__internal__.host.getProjectVersion?.();

			// sort by cost
			templateTs = templateTs.sort((a, b) => a[1] - b[1]);
			scriptTs = scriptTs.sort((a, b) => a[1] - b[1]);

			let all = [...nonTs];
			let mainTsErrorStart = all.length - 1;
			let lastMainError = -1;
			let templateCheckStart = -1;

			const isScriptChanged = lastUpdated.script || lastUpdated.scriptSetup;
			if (isScriptChanged) {
				all = all.concat(scriptTs);
				lastMainError = all.length - 1;
				templateCheckStart = all.length;
				all = all.concat(templateTs);
			}
			else {
				templateCheckStart = all.length;
				all = all.concat(templateTs);
				lastMainError = all.length - 1;
				all = all.concat(scriptTs);
			}

			let isDirty = false;
			let lastResponse: vscode.Diagnostic[] | undefined;

			for (let i = 0; i < all.length; i++) {
				if (await isCancel?.()) return;
				if (i === templateCheckStart) {
					updateTemplateScripts();
				}
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
					.flat();
				const newErrors = (await Promise.all(_newErrors))
					.flat();
				const _oldErrors = all
					.slice(i + 1)
					.map(async diag => i >= mainTsErrorStart && !isScriptChanged ? await diag[0].cache.value : diag[2])
				const oldErrors = (await Promise.all(_oldErrors))
					.flat();
				const isLast = i === all.length - 1
				if (await isCancel?.()) return;
				if (
					isLast
					|| (isDirty && (
						i < mainTsErrorStart
						|| i === lastMainError
						|| oldErrors.length === 0
					))
				) {
					isDirty = false;
					lastResponse = dedupe.withDiagnostics(newErrors.concat(oldErrors));
					response?.(lastResponse);
				}
			}

			return lastResponse;

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
				if (sfcTemplateData.value?.lang === 'html' && sfcTemplateCompileResult.value) {
					return sfcTemplateCompileResult.value.errors;
				}
				return [];
			});
			const pugErrors = computed(() => {

				const result: vscode.Diagnostic[] = [];
				const pugDoc = sfcTemplate.textDocument.value ? getPugDocument(sfcTemplate.textDocument.value) : undefined;

				if (pugDoc) {
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
					else if (sfcTemplateCompileResult.value) {
						const htmlDoc = pugDoc.sourceMap.mappedDocument;
						const vueCompileErrors = sfcTemplateCompileResult.value.errors;
						for (const vueCompileError of vueCompileErrors) {
							let pugRange: vscode.Range | undefined = pugDoc.sourceMap.getSourceRange(vueCompileError.range.start, vueCompileError.range.end)?.[0];
							if (!pugRange) {
								const pugStart = pugDoc.sourceMap.getSourceRange(vueCompileError.range.start, vueCompileError.range.start)?.[0].start;
								const pugEnd = pugDoc.sourceMap.getSourceRange(vueCompileError.range.end, vueCompileError.range.end)?.[0].end;
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
							else if (sfcTemplate.textDocument.value) {
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
			const htmlErrors_cache: Ref<vscode.Diagnostic[]> = ref([]);
			const pugErrors_cache: Ref<vscode.Diagnostic[]> = ref([]);
			const result = computed(() => {
				htmlErrors_cache.value = htmlErrors.value;
				pugErrors_cache.value = pugErrors.value;
				return cacheWithSourceMap.value;
			});
			const cacheWithSourceMap = computed(() => {
				if (!sfcTemplate.textDocument.value) return [];
				return [
					...toSourceDiags(htmlErrors.value, sfcTemplate.textDocument.value.uri, sfcTemplate.textDocument.value.languageId === 'html' && sfcTemplate.sourceMap.value ? [sfcTemplate.sourceMap.value] : []),
					...toSourceDiags(pugErrors.value, sfcTemplate.textDocument.value.uri, sfcTemplate.textDocument.value.languageId === 'jade' && sfcTemplate.sourceMap.value ? [sfcTemplate.sourceMap.value] : []),
				];
			});
			return {
				result,
				cache: cacheWithSourceMap,
			};
		}
		function useScriptSetupWarnings() {
			const errors = computed(() => {
				const result: vscode.Diagnostic[] = [];
				if (scriptSetupRanges.value && descriptor.scriptSetup) {
					for (const range of scriptSetupRanges.value.notOnTopTypeExports) {
						result.push(vscode.Diagnostic.create(
							{
								start: document.value.positionAt(range.start + descriptor.scriptSetup.startTagEnd),
								end: document.value.positionAt(range.end + descriptor.scriptSetup.startTagEnd),
							},
							'type and interface export statements must be on the top in <script setup>',
							vscode.DiagnosticSeverity.Warning,
							undefined,
							'volar',
						));
					}
				}
				return result;
			});
			return {
				result: errors,
				cache: errors,
			};
		}
		function useStylesValidation(documents: Ref<{ textDocument: TextDocument }[]>) {
			const errors = computed(async () => {
				let result = new Map<string, vscode.Diagnostic[]>();
				for (const { textDocument } of documents.value) {
					const stylesheet = getStylesheet(textDocument);
					const cssLs = getCssLs(textDocument.languageId);
					if (!cssLs || !stylesheet) continue;
					const settings = await vueHost.getCssLanguageSettings?.(textDocument);
					const errs = cssLs.doValidation(textDocument, stylesheet, settings ?? undefined /* cssLs accept undefined but not null */) as vscode.Diagnostic[];
					if (errs) result.set(textDocument.uri, errs);
				}
				return result;
			});
			const errors_cache = ref<Map<string, vscode.Diagnostic[]>>(new Map());
			const result = computed(async () => {
				{ // fix can't track .value after await
					cacheWithSourceMap.value
				}
				errors_cache.value = await errors.value;
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
		function useJsonsValidation(documents: Ref<{ textDocument: TextDocument }[]>) {
			const errors = computed(async () => {
				let result = new Map<string, vscode.Diagnostic[]>();
				for (const { textDocument } of documents.value) {

					const jsonDocument = getJsonDocument(textDocument);
					if (!jsonDocument)
						continue;

					const errs = await jsonLs.doValidation(textDocument, jsonDocument, textDocument.languageId === 'json'
						? {
							comments: 'error',
							trailingCommas: 'error',
						}
						: {
							comments: 'ignore',
							trailingCommas: 'warning',
						}) as vscode.Diagnostic[];
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
				{ // fix can't track .value after await
					sfcCustomBlocks.sourceMaps.value
				}
				let result: vscode.Diagnostic[] = [];
				if (errors_cache.value) {
					for (const [uri, errs] of await errors_cache.value) {
						result = result.concat(toSourceDiags(errs, uri, sfcCustomBlocks.sourceMaps.value));
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
								start: document.value.positionAt(script.startTagEnd),
								end: document.value.positionAt(script.startTagEnd + script.content.length),
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
					for (const maped of sfcTemplateScript.sourceMapForFormatting.value.mappings) {
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
		function useScriptValidation(document: Ref<TextDocument | undefined>, mode: 1 | 2 | 3 | 4) {
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
			const errors_cache: Ref<vscode.Diagnostic[]> = ref([]);
			const result = computed(() => {
				errors_cache.value = errors.value;
				return cacheWithSourceMap.value;
			});
			const cacheWithSourceMap = computed(() => {
				const doc = document.value;
				if (!doc) return [];
				return toTsSourceDiags('script', errors_cache.value, doc.uri, templateLsSourceMaps.value);
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
					for (const [propRight] of sfcTemplateScript.teleportSourceMap.value.getSourceRanges(
						diag.range.start,
						diag.range.end,
						sideData => !sideData.isAdditionalReference,
					)) {
						const definitions = templateTsLs.findDefinition(sfcTemplateScript.textDocument.value.uri, propRight.start);
						for (const definition of definitions) {
							if (definition.targetUri !== sfcScriptForTemplateLs.textDocument.value?.uri) continue;
							result.push({
								...diag,
								range: definition.targetSelectionRange,
							});
						}
					}
				}
				return result;
			});
			const errors_1_cache: Ref<vscode.Diagnostic[]> = ref([]);
			const errors_2_cache: Ref<vscode.Diagnostic[]> = ref([]);
			const result = computed(() => {
				errors_1_cache.value = errors_1.value;
				errors_2_cache.value = errors_2.value;
				return cacheWithSourceMap.value;
			});
			const cacheWithSourceMap: ComputedRef<vscode.Diagnostic[]> = computed(() => {
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
		function toSourceDiags(errors: vscode.Diagnostic[], virtualScriptUri: string, sourceMaps: SourceMap[]) {
			const result: vscode.Diagnostic[] = [];
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
							range: vueRange[0],
						});
					}
				}
			}
			return result;
		}
		function toTsSourceDiags(lsType: 'template' | 'script', errors: vscode.Diagnostic[], virtualScriptUri: string, sourceMaps: ScriptSourceMap[]) {
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

						const vueRange = sourceMap.getSourceRange(
							virtualRange.start,
							virtualRange.end,
							data => !!data.capabilities.diagnostic,
						)?.[0];
						if (vueRange) {
							return {
								uri: sourceFile.uri,
								start: vueRange.start,
								end: vueRange.end,
							};
						}
					}
				}
				for (const vueLoc of sourceFiles.fromTsLocation(
					lsType,
					virtualUri,
					virtualRange.start,
					virtualRange.end,
					data => !!data.capabilities.diagnostic,
				)) {
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
