import type { EmbeddedDocumentSourceMap } from '@volar/vue-typescript';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { EmbeddedLanguagePlugin, visitEmbedded } from '../plugins/definePlugin';
import type { DocumentServiceRuntimeContext } from '../types';

export async function documentFeatureWorker<T, K>(
	context: DocumentServiceRuntimeContext,
	document: TextDocument,
	isValidSourceMap: (sourceMap: EmbeddedDocumentSourceMap) => boolean,
	worker: (plugin: EmbeddedLanguagePlugin, document: TextDocument) => T,
	transform: (result: NonNullable<Awaited<T>>, sourceMap: EmbeddedDocumentSourceMap) => T | undefined,
	combineResult?: (results: NonNullable<Awaited<T>>[]) => NonNullable<Awaited<T>>,
) {
	return documentRangeFeatureWorker(
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

export async function documentRangeFeatureWorker<T, K>(
	context: DocumentServiceRuntimeContext,
	document: TextDocument,
	arg: K,
	isValidSourceMap: (sourceMap: EmbeddedDocumentSourceMap) => boolean,
	transformArg: (arg: K, sourceMap: EmbeddedDocumentSourceMap) => Generator<K> | [K],
	worker: (plugin: EmbeddedLanguagePlugin, document: TextDocument, arg: K) => T,
	transform: (result: NonNullable<Awaited<T>>, sourceMap: EmbeddedDocumentSourceMap) => T | undefined,
	combineResult?: (results: NonNullable<Awaited<T>>[]) => NonNullable<Awaited<T>>,
) {

	const vueDocument = context.getVueDocument(document);

	let results: NonNullable<Awaited<T>>[] = [];

	if (vueDocument) {

		const embeddeds = vueDocument.getEmbeddeds();

		await visitEmbedded(embeddeds, async sourceMap => {

			if (!isValidSourceMap(sourceMap))
				return true;

			const plugins = context.getPlugins();

			context.updateTsLs(sourceMap.mappedDocument);

			for (const mapedArg of transformArg(arg, sourceMap)) {

				for (const plugin of plugins) {

					const embeddedResult = await worker(plugin, sourceMap.mappedDocument, mapedArg);

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

			const result = await worker(plugin, document, arg);

			if (!result)
				continue;

			results.push(result!);

			if (!combineResult)
				break;
		}
	}

	if (combineResult) {
		return combineResult(results);
	}
	else if (results.length > 0) {
		return results[0];
	}
}
