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

				const range = sourceMap.toSourceRange(link.range);
				if (range) {
					return {
						...link,
						range,
					};
				}
			}).filter(shared.notEmpty),
			arr => arr.flat(),
		) ?? [];
		const vueDocument = context.documents.get(uri);
		const fictitiousLinks = vueDocument ? getFictitiousLinks(vueDocument) : [];

		return [
			...pluginLinks,
			...fictitiousLinks,
		];

		function getFictitiousLinks(vueDocument: SourceFileDocument) {

			const result: vscode.DocumentLink[] = [];
			const document = vueDocument.getDocument();

			for (const sourceMap of vueDocument.getSourceMaps()) {

				for (const mapped of sourceMap.mappings) {

					if (!mapped.data.displayWithLink)
						continue;

					result.push({
						range: {
							start: document.positionAt(mapped.sourceRange[0]),
							end: document.positionAt(mapped.sourceRange[1]),
						},
						target: uri, // TODO
					});
				}
			}

			return result;
		}
	};
}
