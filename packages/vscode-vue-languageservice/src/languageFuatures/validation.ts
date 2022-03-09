import type { EmbeddedDocumentSourceMap } from '@volar/vue-typescript';
import * as vscode from 'vscode-languageserver-protocol';
import { isTsDocument } from '../plugins/typescript';
import type { LanguageServiceRuntimeContext } from '../types';
import * as dedupe from '../utils/dedupe';
import { languageFeatureWorker } from '../utils/featureWorkers';

export function register(context: LanguageServiceRuntimeContext, updateTemplateScripts: () => void) {

	const responseCache = new Map<
		string,
		{
			nonTs: vscode.Diagnostic[],
			templateTs_1: vscode.Diagnostic[],
			templateTs_2: vscode.Diagnostic[],
			scriptTs_1: vscode.Diagnostic[],
			scriptTs_2: vscode.Diagnostic[],
		}
	>();
	const nonTsCache = new Map<
		number,
		Map<
			string,
			{
				documentVersion: number,
				tsProjectVersion: string | undefined,
				errors: vscode.Diagnostic[] | undefined | null,
			}
		>
	>();
	const templateTsCache_1: typeof nonTsCache = new Map();
	const templateTsCache_2: typeof nonTsCache = new Map();
	const scriptTsCache_1: typeof nonTsCache = new Map();
	const scriptTsCache_2: typeof nonTsCache = new Map();

	return async (uri: string, response?: (result: vscode.Diagnostic[]) => void, isCancel?: () => Promise<boolean>) => {

		const cache = responseCache.get(uri) ?? responseCache.set(uri, {
			nonTs: [],
			templateTs_1: [],
			templateTs_2: [],
			scriptTs_1: [],
			scriptTs_2: [],
		}).get(uri)!;

		let errorsDirty = false; // avoid cache error range jitter

		cache.nonTs = await worker('nonTs', {
			declaration: true,
			semantic: true,
			suggestion: true,
			syntactic: true,
		}, nonTsCache) ?? [];
		doResponse();

		const vueDocument = context.vueDocuments.get(uri);

		if (vueDocument) {

			const lastUpdated = vueDocument.getLastUpdated();

			const isScriptChanged = lastUpdated.script || lastUpdated.scriptSetup;
			if (isScriptChanged) {
				await scriptWorker();
				doResponse();
				await templateWorker();
			}
			else {
				await templateWorker();
				doResponse();
				await scriptWorker();
			}
		}
		else {
			await scriptWorker();
			doResponse();
			await templateWorker();
		}

		return getErrors();

		function doResponse() {
			if (errorsDirty) {
				response?.(getErrors());
				errorsDirty = false;
			}
		}

		async function templateWorker() {

			cache.templateTs_2 = await worker('template', { syntactic: true, suggestion: true }, templateTsCache_2) ?? [];
			doResponse();
			updateTemplateScripts();
			cache.templateTs_1 = await worker('template', { semantic: true }, templateTsCache_1) ?? [];
		}

		async function scriptWorker() {
			cache.scriptTs_2 = await worker('script', { syntactic: true, suggestion: true }, scriptTsCache_2) ?? [];
			doResponse();
			cache.scriptTs_1 = await worker('script', { semantic: true }, scriptTsCache_1) ?? [];
		}

		function getErrors() {
			return [
				...cache.nonTs,
				...cache.templateTs_1,
				...cache.templateTs_2,
				...cache.scriptTs_1,
				...cache.scriptTs_2,
			];
		}

		function worker(
			lsType: 'script' | 'template' | 'nonTs',
			options: {
				declaration?: boolean,
				semantic?: boolean,
				suggestion?: boolean,
				syntactic?: boolean,
			},
			cacheMap: typeof nonTsCache,
		) {
			return languageFeatureWorker(
				context,
				uri,
				true,
				function* (arg, sourceMap) {
					if (sourceMap.capabilities.diagnostics && sourceMap.lsType === lsType) {
						yield arg;
					}
				},
				async (plugin, document, arg, sourceMap) => {

					// avoid duplicate errors from vue plugiin
					if (!isTsDocument(document) && !options.semantic)
						return;

					if (await isCancel?.())
						return;

					const _lsType = sourceMap?.lsType ?? 'script';

					if (lsType !== _lsType)
						return;

					const pluginCache = cacheMap.get(plugin.id) ?? cacheMap.set(plugin.id, new Map()).get(plugin.id)!;
					const cache = pluginCache.get(document.uri);
					const tsProjectVersion = _lsType === 'nonTs' ? undefined : context.getTsLs(_lsType).__internal__.host.getProjectVersion?.();

					if (_lsType === 'nonTs') {
						if (cache && cache.documentVersion === document.version) {
							return cache.errors;
						}
					}
					else {
						if (options.declaration || options.semantic) {
							if (cache && cache.documentVersion === document.version && cache.tsProjectVersion === tsProjectVersion) {
								return cache.errors;
							}
						}
						else {
							if (cache && cache.documentVersion === document.version) {
								return cache.errors;
							}
						}
					}

					const errors = await plugin.doValidation?.(document, options);

					errorsDirty = true;

					pluginCache.set(document.uri, {
						documentVersion: document.version,
						errors,
						tsProjectVersion,
					});

					return errors;
				},
				(errors, sourceMap) => transformErrorRange(sourceMap, errors),
				arr => dedupe.withDiagnostics(arr.flat()),
			);
		}
	};

	function transformErrorRange(sourceMap: EmbeddedDocumentSourceMap | undefined, errors: vscode.Diagnostic[]) {

		const result: vscode.Diagnostic[] = [];

		for (const error of errors) {

			const _error: vscode.Diagnostic = { ...error };

			if (sourceMap) {

				const sourceRange = sourceMap.getSourceRange(error.range.start, error.range.end)?.[0];

				if (!sourceRange)
					continue;

				_error.range = sourceRange;
			}

			if (_error.relatedInformation) {

				const relatedInfos: vscode.DiagnosticRelatedInformation[] = [];

				for (const info of _error.relatedInformation) {
					for (const sourceLoc of context.vueDocuments.fromEmbeddedLocation(
						sourceMap?.lsType ?? 'script',
						info.location.uri,
						info.location.range.start,
						info.location.range.end,
						data => !!data.capabilities.diagnostic,
					)) {
						relatedInfos.push({
							location: {
								uri: sourceLoc.uri,
								range: sourceLoc.range,
							},
							message: info.message,
						});
						break;
					}
				}

				_error.relatedInformation = relatedInfos;
			}

			result.push(_error);
		}

		return result;
	}
}
