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
			(position, map) => map.toGeneratedPositions(position,
				// note https://github.com/johnsoncodehk/volar/issues/2009
				data => typeof data.rename === 'object' ? !!data.rename.normalize : !!data.rename
			),
			async (plugin, document, position) => {

				const recursiveChecker = dedupe.createLocationSet();
				const result: vscode.DocumentHighlight[] = [];

				await withMirrors(document, position);

				return result;

				async function withMirrors(document: TextDocument, position: vscode.Position) {

					if (!plugin.findDocumentHighlights)
						return;

					if (recursiveChecker.has({ uri: document.uri, range: { start: position, end: position } }))
						return;

					recursiveChecker.add({ uri: document.uri, range: { start: position, end: position } });

					const references = await plugin.findDocumentHighlights(document, position) ?? [];

					for (const reference of references) {

						let foundMirrorPosition = false;

						recursiveChecker.add({ uri: document.uri, range: { start: reference.range.start, end: reference.range.start } });

						const mirrorMap = context.documents.getMirrorMapByUri(document.uri)?.[1];

						if (mirrorMap) {

							for (const mapped of mirrorMap.findMirrorPositions(reference.range.start)) {

								if (!mapped[1].references)
									continue;

								if (recursiveChecker.has({ uri: mirrorMap.document.uri, range: { start: mapped[0], end: mapped[0] } }))
									continue;

								foundMirrorPosition = true;

								await withMirrors(mirrorMap.document, mapped[0]);
							}
						}

						if (!foundMirrorPosition) {
							result.push(reference);
						}
					}
				}
			},
			(data, map) => data.map(highlisht => {

				if (!map)
					return highlisht;

				const range = map.toSourceRange(highlisht.range);
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
