import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import * as shared from '@volar/shared';
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
				for (const [mapedRange] of sourceMap.getMappedRanges(
					position,
					position,
					data => !!data.capabilities.references,
				)) {
					yield mapedRange.start;
				}
			},
			async (plugin, document, position, sourceMap) => {

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

						if (sourceMap?.lsType !== 'nonTs') {

							recursiveChecker.add({ uri: reference.uri, range: { start: reference.range.start, end: reference.range.start } });

							const teleport = context.vueDocuments.getTsTeleports(sourceMap?.lsType ?? 'script').get(reference.uri);

							if (teleport) {

								for (const [teleRange] of teleport.findTeleports(
									reference.range.start,
									reference.range.end,
									sideData => !!sideData.capabilities.references,
								)) {

									if (recursiveChecker.has({ uri: teleport.document.uri, range: { start: teleRange.start, end: teleRange.start } }))
										continue;

									foundTeleport = true;

									await withTeleports(teleport.document, teleRange.start);
								}
							}
						}

						if (!foundTeleport) {
							result.push(reference);
						}
					}
				}
			},
			(data, sourceMap) => data.map(reference => {

				const referenceSourceMap = context.vueDocuments.fromEmbeddedDocumentUri(sourceMap?.lsType ?? 'script', reference.uri);

				if (referenceSourceMap) {

					const range = referenceSourceMap.getSourceRange(reference.range.start, reference.range.end)?.[0];

					if (!range)
						return;

					reference.uri = referenceSourceMap.sourceDocument.uri;
					reference.range = range;
				}

				return reference;
			}).filter(shared.notEmpty),
			arr => dedupe.withLocations(arr.flat()),
		);
	}
}
