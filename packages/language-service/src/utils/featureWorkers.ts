import type { TextDocument } from 'vscode-languageserver-textdocument';
import { visitEmbedded } from './definePlugin';
import type { DocumentServiceRuntimeContext, LanguageServiceRuntimeContext } from '../types';
import { LanguageServicePlugin, PositionCapabilities, VirtualFile } from '@volar/language-service';
import { SourceMap } from '../documents';

export async function documentFeatureWorker<T>(
	context: DocumentServiceRuntimeContext,
	document: TextDocument,
	isValidSourceMap: (file: VirtualFile, sourceMap: SourceMap<PositionCapabilities>) => boolean,
	worker: (plugin: LanguageServicePlugin, document: TextDocument) => T,
	transform: (result: NonNullable<Awaited<T>>, sourceMap: SourceMap<PositionCapabilities>) => T | undefined,
	combineResult?: (results: NonNullable<Awaited<T>>[]) => NonNullable<Awaited<T>>,
) {
	return documentArgFeatureWorker(
		context,
		document,
		true,
		isValidSourceMap,
		() => [true],
		worker,
		transform,
		combineResult,
	);
}

export async function documentArgFeatureWorker<T, K>(
	context: DocumentServiceRuntimeContext,
	document: TextDocument,
	arg: K,
	isValidSourceMap: (file: VirtualFile, sourceMap: SourceMap<PositionCapabilities>) => boolean,
	transformArg: (arg: K, sourceMap: SourceMap<PositionCapabilities>) => Generator<K> | K[],
	worker: (plugin: LanguageServicePlugin, document: TextDocument, arg: K) => T,
	transform: (result: NonNullable<Awaited<T>>, sourceMap: SourceMap<PositionCapabilities>) => T | undefined,
	combineResult?: (results: NonNullable<Awaited<T>>[]) => NonNullable<Awaited<T>>,
) {

	context.update(document);
	const virtualFile = context.documents.getRootFileBySourceFileUri(document.uri);

	let results: NonNullable<Awaited<T>>[] = [];

	if (virtualFile) {

		await visitEmbedded(context.documents, virtualFile, async (file, map) => {

			if (!isValidSourceMap(file, map))
				return true;

			context.prepareLanguageServices(map.mappedDocument);

			for (const mappedArg of transformArg(arg, map)) {

				for (const plugin of context.plugins) {

					const embeddedResult = await worker(plugin, map.mappedDocument, mappedArg);

					if (!embeddedResult)
						continue;

					const result = await transform(embeddedResult!, map);

					if (!result)
						continue;

					results.push(result!);

					if (!combineResult)
						return false;
				}
			}

			return true;
		});
	}
	else if (results.length === 0 || !!combineResult) {

		context.prepareLanguageServices(document);

		for (const plugin of context.plugins) {

			const result = await worker(plugin, document, arg);

			if (!result)
				continue;

			results.push(result!);

			if (!combineResult)
				break;
		}
	}

	if (combineResult && results.length > 0) {
		return combineResult(results);
	}
	else if (results.length > 0) {
		return results[0];
	}
}

export async function languageFeatureWorker<T, K>(
	context: LanguageServiceRuntimeContext,
	uri: string,
	arg: K,
	transformArg: (arg: K, sourceMap: SourceMap<PositionCapabilities>, file: VirtualFile) => Generator<K> | K[],
	worker: (plugin: LanguageServicePlugin, document: TextDocument, arg: K, sourceMap: SourceMap<PositionCapabilities> | undefined, file: VirtualFile | undefined) => T,
	transform: (result: NonNullable<Awaited<T>>, sourceMap: SourceMap<PositionCapabilities> | undefined) => Awaited<T> | undefined,
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

					const embeddedResult = await worker(plugin, map.mappedDocument, mappedArg, map, file);

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
	else if (document && (results.length === 0 || !!combineResult)) {

		for (const plugin of context.plugins) {

			const embeddedResult = await worker(plugin, document, arg, undefined, undefined);

			if (!embeddedResult)
				continue;

			const result = transform(embeddedResult!, undefined);

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
