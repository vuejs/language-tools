import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import * as shared from '@volar/shared';
import { languageFeatureWorker } from '../utils/featureWorkers';
import { SourceFileDocument } from '../documents';

export function register(context: LanguageServiceRuntimeContext) {

	return async (uri: string) => {

		const pluginLinks = await languageFeatureWorker(
			context,
			uri,
			undefined,
			(arg, sourceMap) => [arg],
			(plugin, document, arg) => plugin.findDocumentLinks?.(document),
			(data, sourceMap) => data.map(link => {

				if (!sourceMap)
					return link;

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

		function getFictitiousLinks(vueDocument: SourceFileDocument) {

			const result: vscode.DocumentLink[] = [];
			const document = vueDocument.getDocument();

			for (const sourceMap of vueDocument.getSourceMaps()) {

				for (const mapped of sourceMap.base.mappings) {

					if (!mapped.data.capabilities.displayWithLink)
						continue;

					result.push({
						range: {
							start: document.positionAt(mapped.sourceRange.start),
							end: document.positionAt(mapped.sourceRange.end),
						},
						target: uri, // TODO
					});
				}
			}

			return result;
		}
	};
}
