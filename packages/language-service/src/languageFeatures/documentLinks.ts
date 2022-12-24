import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import * as shared from '@volar/shared';
import { languageFeatureWorker } from '../utils/featureWorkers';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { SourceMap } from '../documents';
import { PositionCapabilities, VirtualFile } from '@volar/language-core';

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
		const maps = context.documents.getMapsBySourceFileUri(uri);
		const fictitiousLinks = maps ? getFictitiousLinks(context.documents.getDocumentByUri(maps.snapshot, uri), maps.maps) : [];

		return [
			...pluginLinks,
			...fictitiousLinks,
		];

		function getFictitiousLinks(document: TextDocument, maps: [VirtualFile, SourceMap<PositionCapabilities>][]) {

			const result: vscode.DocumentLink[] = [];

			for (const [_, map] of maps) {

				for (const mapped of map.map.mappings) {

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
