import * as vscode from 'vscode-languageserver-protocol';
import { isTsDocument } from '../commonPlugins/typescript';
import type { LanguageServiceRuntimeContext } from '../types';
import * as dedupe from '../utils/dedupe';
import { languageFeatureWorker } from '../utils/featureWorkers';
import { EmbeddedDocumentSourceMap } from '../vueDocuments';

export function register(context: LanguageServiceRuntimeContext) {

	const responseCache = new Map<
		string,
		{
			nonTs: vscode.Diagnostic[],
			templateTs_semantic: vscode.Diagnostic[],
			templateTs_syntactic: vscode.Diagnostic[],
			templateTs_suggestion: vscode.Diagnostic[],
			scriptTs_semantic: vscode.Diagnostic[],
			scriptTs_syntactic: vscode.Diagnostic[],
			scriptTs_suggestion: vscode.Diagnostic[],
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
	const scriptTsCache_semantic: typeof nonTsCache = new Map();
	const scriptTsCache_syntactic: typeof nonTsCache = new Map();
	const scriptTsCache_suggestion: typeof nonTsCache = new Map();

	return async (uri: string, response?: (result: vscode.Diagnostic[]) => void, isCancel?: () => Promise<boolean>) => {

		const cache = responseCache.get(uri) ?? responseCache.set(uri, {
			nonTs: [],
			templateTs_semantic: [],
			templateTs_suggestion: [],
			templateTs_syntactic: [],
			scriptTs_semantic: [],
			scriptTs_suggestion: [],
			scriptTs_syntactic: [],
		}).get(uri)!;

		let errorsDirty = false; // avoid cache error range jitter

		await worker(false, {
			declaration: true,
			semantic: true,
			suggestion: true,
			syntactic: true,
		}, nonTsCache, errors => cache.nonTs = errors ?? []);
		doResponse();
		await worker(true, { syntactic: true }, scriptTsCache_syntactic, errors => cache.scriptTs_syntactic = errors ?? []);
		await worker(true, { suggestion: true }, scriptTsCache_suggestion, errors => cache.scriptTs_suggestion = errors ?? []);
		doResponse();
		await worker(true, { semantic: true }, scriptTsCache_semantic, errors => cache.scriptTs_semantic = errors ?? []);

		return getErrors();

		function doResponse() {
			if (errorsDirty) {
				response?.(getErrors());
				errorsDirty = false;
			}
		}

		function getErrors() {
			return [
				...cache.nonTs,
				...cache.templateTs_syntactic,
				...cache.templateTs_suggestion,
				...cache.templateTs_semantic,
				...cache.scriptTs_syntactic,
				...cache.scriptTs_suggestion,
				...cache.scriptTs_semantic,
			];
		}

		async function worker(
			isTs: boolean,
			options: {
				declaration?: boolean,
				semantic?: boolean,
				suggestion?: boolean,
				syntactic?: boolean,
			},
			cacheMap: typeof nonTsCache,
			response: (result: vscode.Diagnostic[] | undefined) => void,
		) {
			const result = await languageFeatureWorker(
				context,
				uri,
				true,
				function* (arg, sourceMap) {

					const isTsFile = sourceMap.embeddedFile.fileName.endsWith('.js') ||
						sourceMap.embeddedFile.fileName.endsWith('.ts') ||
						sourceMap.embeddedFile.fileName.endsWith('.jsx') ||
						sourceMap.embeddedFile.fileName.endsWith('.tsx')

					if (sourceMap.embeddedFile.capabilities.diagnostics && isTsFile === isTs) {
						yield arg;
					}
				},
				async (plugin, document, arg, sourceMap) => {

					// avoid duplicate errors from vue plugiin
					if (!isTsDocument(document) && !options.semantic)
						return;

					if (await isCancel?.())
						return;

					const pluginCache = cacheMap.get(plugin.id) ?? cacheMap.set(plugin.id, new Map()).get(plugin.id)!;
					const cache = pluginCache.get(document.uri);
					const tsProjectVersion = isTs ? undefined : context.getTsLs().__internal__.host.getProjectVersion?.();

					if (!isTs) {
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
			if (!await isCancel?.())
				response(result);
		}
	};

	function transformErrorRange(sourceMap: EmbeddedDocumentSourceMap | undefined, errors: vscode.Diagnostic[]) {

		const result: vscode.Diagnostic[] = [];

		for (const error of errors) {

			const _error: vscode.Diagnostic = { ...error };

			if (sourceMap) {

				const sourceRange = sourceMap.getSourceRange(
					error.range.start,
					error.range.end,
					data => !!data.capabilities.diagnostic,
				)?.[0];

				if (!sourceRange)
					continue;

				_error.range = sourceRange;
			}

			if (_error.relatedInformation) {

				const relatedInfos: vscode.DiagnosticRelatedInformation[] = [];

				for (const info of _error.relatedInformation) {
					for (const sourceLoc of context.vueDocuments.fromEmbeddedLocation(
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
