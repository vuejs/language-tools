import type { TextDocument } from 'vscode-languageserver-textdocument';
import { visitEmbedded } from './definePlugin';
import type { DocumentServiceRuntimeContext, LanguageServiceRuntimeContext } from '../types';
import { EmbeddedLanguageServicePlugin } from '@volar/vue-language-service-types';
import { EmbeddedDocumentSourceMap, VueDocument } from '../vueDocuments';

export async function documentFeatureWorker<T>(
	context: DocumentServiceRuntimeContext,
	document: TextDocument,
	isValidSourceMap: (sourceMap: EmbeddedDocumentSourceMap) => boolean,
	worker: (plugin: EmbeddedLanguageServicePlugin, document: TextDocument) => T,
	transform: (result: NonNullable<Awaited<T>>, sourceMap: EmbeddedDocumentSourceMap | undefined) => T | undefined,
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
	transformArg: (arg: K, sourceMap: EmbeddedDocumentSourceMap) => Generator<K> | [K],
	worker: (plugin: EmbeddedLanguageServicePlugin, document: TextDocument, arg: K) => T,
	transform: (result: NonNullable<Awaited<T>>, sourceMap: EmbeddedDocumentSourceMap | undefined) => T | undefined,
	combineResult?: (results: NonNullable<Awaited<T>>[]) => NonNullable<Awaited<T>>,
) {

	const vueDocument = context.getVueDocument(document);

	let results: NonNullable<Awaited<T>>[] = [];

	if (vueDocument) {

		const embeddeds = vueDocument.file.embeddeds;

		await visitEmbedded(vueDocument, embeddeds, async sourceMap => {

			if (!isValidSourceMap(sourceMap))
				return true;

			const plugins = context.getPlugins();

			context.updateTsLs(sourceMap.mappedDocument);

			for (const mappedArg of transformArg(arg, sourceMap)) {

				for (const plugin of plugins) {

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

	if (results.length === 0 || !!combineResult) {

		const plugins = context.getPlugins();

		context.updateTsLs(document);

		for (const plugin of plugins) {

			const embeddedResult = await worker(plugin, document, arg);

			if (!embeddedResult)
				continue;

			const result = await transform(embeddedResult!, undefined);

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
	worker: (plugin: EmbeddedLanguageServicePlugin, document: TextDocument, arg: K, sourceMap: EmbeddedDocumentSourceMap | undefined, vueDocument: VueDocument | undefined) => T,
	transform: (result: NonNullable<Awaited<T>>, sourceMap: EmbeddedDocumentSourceMap | undefined) => Awaited<T> | undefined,
	combineResult?: (results: NonNullable<Awaited<T>>[]) => NonNullable<Awaited<T>>,
	reportProgress?: (result: NonNullable<Awaited<T>>) => void,
) {

	const document = context.getTextDocument(uri);
	const vueDocument = context.vueDocuments.get(uri);

	let results: NonNullable<Awaited<T>>[] = [];

	if (vueDocument) {

		const embeddeds = vueDocument.file.embeddeds;

		await visitEmbedded(vueDocument, embeddeds, async sourceMap => {

			const plugins = context.getPlugins();

			for (const mappedArg of transformArg(arg, sourceMap)) {

				for (const plugin of plugins) {

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

	if (document && (results.length === 0 || !!combineResult)) {

		const plugins = context.getPlugins();

		for (const plugin of plugins) {

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
