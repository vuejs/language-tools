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
				for (const mapped of sourceMap.toGeneratedPositions(position)) {
					if (mapped[1].data.references) {
						yield mapped[0];
					}
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
			(data, sourceMap) => data.map(highlisht => {

				if (!sourceMap)
					return highlisht;

				const start = sourceMap.toSourcePosition(highlisht.range.start)?.[0];
				const end = sourceMap.toSourcePosition(highlisht.range.end)?.[0];

				if (start && end) {
					return {
						...highlisht,
						range: { start, end },
					};
				}
			}).filter(shared.notEmpty),
			arr => arr.flat(),
		);
	};
}
