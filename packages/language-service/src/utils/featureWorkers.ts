import type { TextDocument } from 'vscode-languageserver-textdocument';
import { visitEmbedded } from './definePlugin';
import type { LanguageServiceRuntimeContext } from '../types';
import { LanguageServicePlugin, FileRangeCapabilities, VirtualFile } from '@volar/language-service';
import { SourceMapWithDocuments } from '../documents';

export async function documentFeatureWorker<T>(
	context: LanguageServiceRuntimeContext,
	uri: string,
	isValidSourceMap: (file: VirtualFile, sourceMap: SourceMapWithDocuments<FileRangeCapabilities>) => boolean,
	worker: (plugin: LanguageServicePlugin, document: TextDocument) => T,
	transform: (result: NonNullable<Awaited<T>>, sourceMap: SourceMapWithDocuments<FileRangeCapabilities>) => Awaited<T> | undefined,
	combineResult?: (results: NonNullable<Awaited<T>>[]) => NonNullable<Awaited<T>>,
) {
	return languageFeatureWorker(
		context,
		uri,
		true,
		(_, map, file) => {
			if (isValidSourceMap(file, map)) {
				return [true];
			}
			return [];
		},
		worker,
		transform,
		combineResult,
	);
}

export async function languageFeatureWorker<T, K>(
	context: LanguageServiceRuntimeContext,
	uri: string,
	arg: K,
	transformArg: (arg: K, sourceMap: SourceMapWithDocuments<FileRangeCapabilities>, file: VirtualFile) => Generator<K> | K[],
	worker: (plugin: LanguageServicePlugin, document: TextDocument, arg: K, sourceMap: SourceMapWithDocuments<FileRangeCapabilities> | undefined, file: VirtualFile | undefined) => T,
	transform: (result: NonNullable<Awaited<T>>, sourceMap: SourceMapWithDocuments<FileRangeCapabilities>) => Awaited<T> | undefined,
	combineResult?: (results: NonNullable<Awaited<T>>[]) => NonNullable<Awaited<T>>,
	reportProgress?: (result: NonNullable<Awaited<T>>) => void,
) {

	const document = context.getTextDocument(uri);
	const virtualFile = context.documents.getRootFileBySourceFileUri(uri);

	let results: NonNullable<Awaited<T>>[] = [];

	if (virtualFile) {

		await visitEmbedded(context.documents, virtualFile, async (file, map) => {

			for (const mappedArg of transformArg(arg, map, file)) {

				for (const plugin of context.plugins) {

					const embeddedResult = await worker(plugin, map.virtualFileDocument, mappedArg, map, file);

					if (!embeddedResult)
						continue;

					const result = transform(embeddedResult!, map);

					if (!result)
						continue;

					results.push(result!);

					if (!combineResult)
						return false;

					const isEmptyArray = Array.isArray(result) && result.length === 0;

					if (reportProgress && !isEmptyArray) {
						reportProgress(combineResult(results));
					}
				}
			}

			return true;
		});
	}
	else if (document) {

		for (const plugin of context.plugins) {

			const result = await worker(plugin, document, arg, undefined, undefined);
			if (!result)
				continue;

			results.push(result!);

			if (!combineResult)
				break;

			const isEmptyArray = Array.isArray(result) && result.length === 0;

			if (reportProgress && !isEmptyArray) {
				reportProgress(combineResult(results));
			}
		}
	}

	if (combineResult && results.length > 0) {
		return combineResult(results);
	}
	else if (results.length > 0) {
		return results[0];
	}
}
