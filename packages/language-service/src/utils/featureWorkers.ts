import type { TextDocument } from 'vscode-languageserver-textdocument';
import { visitEmbedded } from './definePlugin';
import type { DocumentServiceRuntimeContext, LanguageServiceRuntimeContext } from '../types';
import { LanguageServicePlugin } from '@volar/language-service';
import { EmbeddedDocumentSourceMap, SourceFileDocument } from '../documents';

export async function documentFeatureWorker<T>(
	context: DocumentServiceRuntimeContext,
	document: TextDocument,
	isValidSourceMap: (sourceMap: EmbeddedDocumentSourceMap) => boolean,
	worker: (plugin: LanguageServicePlugin, document: TextDocument) => T,
	transform: (result: NonNullable<Awaited<T>>, sourceMap: EmbeddedDocumentSourceMap) => T | undefined,
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
	isValidSourceMap: (sourceMap: EmbeddedDocumentSourceMap) => boolean,
	transformArg: (arg: K, sourceMap: EmbeddedDocumentSourceMap) => Generator<K> | K[],
	worker: (plugin: LanguageServicePlugin, document: TextDocument, arg: K) => T,
	transform: (result: NonNullable<Awaited<T>>, sourceMap: EmbeddedDocumentSourceMap) => T | undefined,
	combineResult?: (results: NonNullable<Awaited<T>>[]) => NonNullable<Awaited<T>>,
) {

	const vueDocument = context.getVirtualDocuments(document);

	let results: NonNullable<Awaited<T>>[] = [];

	if (vueDocument) {

		await visitEmbedded(vueDocument, async sourceMap => {

			if (!isValidSourceMap(sourceMap))
				return true;

			context.prepareLanguageServices(sourceMap.mappedDocument);

			for (const mappedArg of transformArg(arg, sourceMap)) {

				for (const plugin of context.plugins) {

					const embeddedResult = await worker(plugin, sourceMap.mappedDocument, mappedArg);

					if (!embeddedResult)
						continue;

					const result = await transform(embeddedResult!, sourceMap);

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
	transformArg: (arg: K, sourceMap: EmbeddedDocumentSourceMap) => Generator<K> | K[],
	worker: (plugin: LanguageServicePlugin, document: TextDocument, arg: K, sourceMap: EmbeddedDocumentSourceMap | undefined, vueDocument: SourceFileDocument | undefined) => T,
	transform: (result: NonNullable<Awaited<T>>, sourceMap: EmbeddedDocumentSourceMap | undefined) => Awaited<T> | undefined,
	combineResult?: (results: NonNullable<Awaited<T>>[]) => NonNullable<Awaited<T>>,
	reportProgress?: (result: NonNullable<Awaited<T>>) => void,
) {

	const document = context.getTextDocument(uri);
	const vueDocument = context.documents.get(uri);

	let results: NonNullable<Awaited<T>>[] = [];

	if (vueDocument) {

		await visitEmbedded(vueDocument, async sourceMap => {

			for (const mappedArg of transformArg(arg, sourceMap)) {

				for (const plugin of context.plugins) {

					const embeddedResult = await worker(plugin, sourceMap.mappedDocument, mappedArg, sourceMap, vueDocument);

					if (!embeddedResult)
						continue;

					const result = transform(embeddedResult!, sourceMap);

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
