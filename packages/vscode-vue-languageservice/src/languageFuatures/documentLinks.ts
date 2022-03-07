import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import * as shared from '@volar/shared';
import { languageFeatureWorker } from '../utils/featureWorkers';
import { VueDocument } from '@volar/vue-typescript';

export function register(context: LanguageServiceRuntimeContext) {

	return async (uri: string) => {

		const pluginLinks = await languageFeatureWorker(
			context,
			uri,
			undefined,
			(arg, sourceMap) => [arg],
			(plugin, document, arg) => plugin.findDocumentLinks?.(document),
			(data, sourceMap) => data.map(link => {
				const range = sourceMap.getSourceRange(link.range.start, link.range.end)?.[0];
				if (range) {
					return {
						...link,
						range,
					};
				}
			}).filter(shared.notEmpty),
			arr => arr.flat(),
		) ?? [];
		const vueDocument = context.vueDocuments.get(uri);
		const fictitiousLinks = vueDocument ? getFictitiousLinks(vueDocument) : [];

		return [
			...pluginLinks,
			...fictitiousLinks,
		];

		function getFictitiousLinks(vueDocument: VueDocument) {

			const result: vscode.DocumentLink[] = [];
			const document = vueDocument.getTextDocument();

			for (const sourceMap of vueDocument.getSourceMaps()) {

				for (const maped of sourceMap.mappings) {

					if (!maped.data.capabilities.displayWithLink)
						continue;

					result.push({
						range: {
							start: document.positionAt(maped.sourceRange.start),
							end: document.positionAt(maped.sourceRange.end),
						},
						target: uri, // TODO
					});
				}
			}

			return result;
		}
	}
}
