import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import * as shared from '@volar/shared';
import { languageFeatureWorker } from '../utils/featureWorkers';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { EmbeddedDocumentSourceMap } from '../documents';

export function register(context: LanguageServiceRuntimeContext) {

	return async (uri: string) => {

		const pluginLinks = await languageFeatureWorker(
			context,
			uri,
			undefined,
			(arg) => [arg],
			(plugin, document) => plugin.findDocumentLinks?.(document),
			(data, map) => data.map(link => {

				if (!map)
					return link;

				const range = map.toSourceRange(link.range);
				if (range) {
					return {
						...link,
						range,
					};
				}
			}).filter(shared.notEmpty),
			arr => arr.flat(),
		) ?? [];
		const maps = context.documents.get(uri);
		const fictitiousLinks = maps ? getFictitiousLinks(maps.document, [...maps.maps.values()]) : [];

		return [
			...pluginLinks,
			...fictitiousLinks,
		];

		function getFictitiousLinks(document: TextDocument, maps: EmbeddedDocumentSourceMap[]) {

			const result: vscode.DocumentLink[] = [];

			for (const map of maps) {

				for (const mapped of map.mappings) {

					if (!mapped.data.displayWithLink)
						continue;

					if (mapped.sourceRange[0] === mapped.sourceRange[1])
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
