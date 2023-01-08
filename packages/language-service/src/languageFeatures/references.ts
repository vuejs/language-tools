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
			(position, map) => map.toGeneratedPositions(position, data => !!data.references),
			async (plugin, document, position) => {

				const recursiveChecker = dedupe.createLocationSet();
				const result: vscode.Location[] = [];

				await withMirrors(document, position);

				return result;

				async function withMirrors(document: TextDocument, position: vscode.Position) {

					if (!plugin.findReferences)
						return;

					if (recursiveChecker.has({ uri: document.uri, range: { start: position, end: position } }))
						return;

					recursiveChecker.add({ uri: document.uri, range: { start: position, end: position } });

					const references = await plugin.findReferences(document, position) ?? [];

					for (const reference of references) {

						let foundMirrorPosition = false;

						recursiveChecker.add({ uri: reference.uri, range: { start: reference.range.start, end: reference.range.start } });

						const mirrorMap = context.documents.getMirrorMapByUri(reference.uri)?.[1];

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
			(data) => {

				const results: vscode.Location[] = [];

				for (const reference of data) {
					if (context.documents.hasVirtualFileByUri(reference.uri)) {
						for (const [_, map] of context.documents.getMapsByVirtualFileUri(reference.uri)) {
							const range = map.toSourceRange(reference.range, data => !!data.references);
							if (range) {
								results.push({
									uri: map.sourceFileDocument.uri,
									range,
								});
							}
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
