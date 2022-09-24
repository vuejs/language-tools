import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import { languageFeatureWorker } from '../utils/featureWorkers';
import * as dedupe from '../utils/dedupe';
import { TextDocument } from 'vscode-languageserver-textdocument';

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
				const result: vscode.Location[] = [];

				await withTeleports(document, position);

				return result;

				async function withTeleports(document: TextDocument, position: vscode.Position) {

					if (!plugin.findReferences)
						return;

					if (recursiveChecker.has({ uri: document.uri, range: { start: position, end: position } }))
						return;

					recursiveChecker.add({ uri: document.uri, range: { start: position, end: position } });

					const references = await plugin.findReferences(document, position) ?? [];

					for (const reference of references) {

						let foundTeleport = false;

						recursiveChecker.add({ uri: reference.uri, range: { start: reference.range.start, end: reference.range.start } });

						const teleport = context.documents.teleportfromEmbeddedDocumentUri(reference.uri);

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
			(data, sourceMap) => {

				const results: vscode.Location[] = [];

				for (const reference of data) {

					const referenceSourceMap = context.documents.sourceMapFromEmbeddedDocumentUri(reference.uri);

					if (referenceSourceMap) {

						for (const [range] of referenceSourceMap.getSourceRanges(
							reference.range.start,
							reference.range.end,
							data => !!data.references,
						)) {
							results.push({
								uri: referenceSourceMap.sourceDocument.uri,
								range,
							});
						}
					}

					results.push(reference);
				}

				return results;
			},
			arr => dedupe.withLocations(arr.flat()),
		);
	};
}
