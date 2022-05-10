import * as vscode from 'vscode-languageserver-protocol';
import { isTsDocument } from '../plugins/typescript';
import type { LanguageServiceRuntimeContext } from '../types';
import * as dedupe from '../utils/dedupe';
import { languageFeatureWorker } from '../utils/featureWorkers';
import { EmbeddedDocumentSourceMap } from '../vueDocuments';

export function register(context: LanguageServiceRuntimeContext) {

	const responseCache = new Map<
		string,
		{
			nonTs: vscode.Diagnostic[],
			tsSemantic: vscode.Diagnostic[],
			tsDeclaration: vscode.Diagnostic[],
			tsSyntactic: vscode.Diagnostic[],
			tsSuggestion: vscode.Diagnostic[],
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
	const scriptTsCache_declaration: typeof nonTsCache = new Map();
	const scriptTsCache_syntactic: typeof nonTsCache = new Map();
	const scriptTsCache_suggestion: typeof nonTsCache = new Map();

	return async (uri: string, response?: (result: vscode.Diagnostic[]) => void, isCancel?: () => Promise<boolean>) => {

		const cache = responseCache.get(uri) ?? responseCache.set(uri, {
			nonTs: [],
			tsSemantic: [],
			tsDeclaration: [],
			tsSuggestion: [],
			tsSyntactic: [],
		}).get(uri)!;

		let errorsDirty = false; // avoid cache error range jitter

		await worker(false, {
			declaration: true,
			semantic: true,
			suggestion: true,
			syntactic: true,
		}, nonTsCache, errors => cache.nonTs = errors ?? []);
		doResponse();
		await worker(true, { syntactic: true }, scriptTsCache_syntactic, errors => cache.tsSyntactic = errors ?? []);
		await worker(true, { suggestion: true }, scriptTsCache_suggestion, errors => cache.tsSuggestion = errors ?? []);
		doResponse();
		await worker(true, { semantic: true }, scriptTsCache_semantic, errors => cache.tsSemantic = errors ?? []);
		doResponse();
		await worker(true, { declaration: true }, scriptTsCache_declaration, errors => cache.tsDeclaration = errors ?? []);

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
				...cache.tsSyntactic,
				...cache.tsSuggestion,
				...cache.tsSemantic,
				...cache.tsDeclaration,
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
					if (sourceMap.embeddedFile.capabilities.diagnostics && sourceMap.embeddedFile.isTsHostFile === isTs) {
						yield arg;
					}
				},
				async (plugin, document, arg, sourceMap) => {

					// avoid duplicate errors from vue plugin & typescript plugin
					if (isTsDocument(document) !== isTs)
						return;

					if (await isCancel?.())
						return;

					const pluginId = context.getPluginId(plugin);
					const pluginCache = cacheMap.get(pluginId) ?? cacheMap.set(pluginId, new Map()).get(pluginId)!;
					const cache = pluginCache.get(document.uri);
					const tsProjectVersion = isTs ? context.getTsLs().__internal__.host.getProjectVersion?.() : undefined;

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

				let sourceRange = sourceMap.getSourceRange(
					error.range.start,
					error.range.end,
					data => !!data.capabilities.diagnostic,
				)?.[0];

				// fix https://github.com/johnsoncodehk/volar/issues/1205
				// fix https://github.com/johnsoncodehk/volar/issues/1264
				if (!sourceRange) {
					const start = sourceMap.getSourceRange(
						error.range.start,
						error.range.start,
						data => !!data.capabilities.diagnostic,
					)?.[0].start;
					const end = sourceMap.getSourceRange(
						error.range.end,
						error.range.end,
						data => !!data.capabilities.diagnostic,
					)?.[0].end;
					if (start && end) {
						sourceRange = { start, end };
					}
				}

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
