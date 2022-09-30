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
			(position, sourceMap) => sourceMap.toGeneratedPositions(position, data => !!data.references),
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

							for (const mapped of teleport.findTeleports(reference.range.start)) {

								if (!mapped[1].references)
									continue;

								if (recursiveChecker.has({ uri: teleport.document.uri, range: { start: mapped[0], end: mapped[0] } }))
									continue;

								foundTeleport = true;

								await withTeleports(teleport.document, mapped[0]);
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
					const map = context.documents.sourceMapFromEmbeddedDocumentUri(reference.uri);
					if (map) {
						const range = map.toSourceRange(reference.range, data => !!data.references);
						if (range) {
							results.push({
								uri: map.sourceDocument.uri,
								range,
							});
						}
					}
					else {
						results.push(reference);
					}
				}

				return results;
			},
			arr => dedupe.withLocations(arr.flat()),
		);
	};
}
