import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import * as shared from '@volar/shared';
import { languageFeatureWorker } from '../utils/featureWorkers';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as dedupe from '../utils/dedupe';

export function register(context: LanguageServiceRuntimeContext) {

	return (uri: string, position: vscode.Position) => {

		return languageFeatureWorker(
			context,
			uri,
			position,
			function* (position, sourceMap) {
				for (const [mappedRange] of sourceMap.getMappedRanges(
					position,
					position,
					data => !!data.references,
				)) {
					yield mappedRange.start;
				}
			},
			async (plugin, document, position, sourceMap, vueDocument) => {

				const recursiveChecker = dedupe.createLocationSet();
				const result: vscode.DocumentHighlight[] = [];

				await withTeleports(document, position);

				return result;

				async function withTeleports(document: TextDocument, position: vscode.Position) {

					if (!plugin.findDocumentHighlights)
						return;

					if (recursiveChecker.has({ uri: document.uri, range: { start: position, end: position } }))
						return;

					recursiveChecker.add({ uri: document.uri, range: { start: position, end: position } });

					const references = await plugin.findDocumentHighlights(document, position) ?? [];

					for (const reference of references) {

						let foundTeleport = false;

						recursiveChecker.add({ uri: document.uri, range: { start: reference.range.start, end: reference.range.start } });

						const teleport = context.documents.teleportfromEmbeddedDocumentUri(document.uri);

						if (teleport) {

							for (const [teleRange] of teleport.findTeleports(
								reference.range.start,
								reference.range.end,
								sideData => !!sideData.references,
							)) {

								if (recursiveChecker.has({ uri: teleport.document.uri, range: { start: teleRange.start, end: teleRange.start } }))
									continue;

								foundTeleport = true;

								await withTeleports(teleport.document, teleRange.start);
							}
						}

						if (!foundTeleport) {
							result.push(reference);
						}
					}
				}
			},
			(data, sourceMap) => data.map(highlisht => {

				if (!sourceMap)
					return highlisht;

				const range = sourceMap.getSourceRange(highlisht.range.start, highlisht.range.end)?.[0];

				if (range) {
					return {
						...highlisht,
						range,
					};
				}
			}).filter(shared.notEmpty),
			arr => arr.flat(),
		);
	};
}
