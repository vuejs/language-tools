import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import * as shared from '@volar/shared';
import { languageFeatureWorker } from '../utils/featureWorkers';
import * as dedupe from '../utils/dedupe';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { EmbeddedFileMappingData, TeleportSideData } from '@volar/embedded-language-core';

export function register(
	context: LanguageServiceRuntimeContext,
	api: 'findDefinition' | 'findTypeDefinition' | 'findImplementations',
	isValidMappingData: (data: EmbeddedFileMappingData) => boolean,
	isValidTeleportSideData: (sideData: TeleportSideData) => boolean,
) {

	return (uri: string, position: vscode.Position) => {

		return languageFeatureWorker(
			context,
			uri,
			position,
			function* (position, sourceMap) {
				for (const [mappedRange] of sourceMap.getMappedRanges(
					position,
					position,
					isValidMappingData,
				)) {
					yield mappedRange.start;
				}
			},
			async (plugin, document, position, sourceMap) => {

				const recursiveChecker = dedupe.createLocationSet();
				const result: vscode.LocationLink[] = [];

				await withTeleports(document, position, undefined);

				return result;

				async function withTeleports(document: TextDocument, position: vscode.Position, originDefinition: vscode.LocationLink | undefined) {

					const _api = api === 'findDefinition' ? plugin.definition?.on :
						api === 'findTypeDefinition' ? plugin.definition?.onType :
							api === 'findImplementations' ? plugin.findImplementations :
								undefined;

					if (!_api)
						return;

					if (recursiveChecker.has({ uri: document.uri, range: { start: position, end: position } }))
						return;

					recursiveChecker.add({ uri: document.uri, range: { start: position, end: position } });

					const definitions = await _api?.(document, position) ?? [];

					for (const definition of definitions) {

						let foundTeleport = false;

						recursiveChecker.add({ uri: definition.targetUri, range: { start: definition.targetRange.start, end: definition.targetRange.start } });

						const teleport = context.documents.teleportfromEmbeddedDocumentUri(definition.targetUri);

						if (teleport) {

							for (const [teleRange] of teleport.findTeleports(
								definition.targetSelectionRange.start,
								definition.targetSelectionRange.end,
								isValidTeleportSideData,
							)) {

								if (recursiveChecker.has({ uri: teleport.document.uri, range: { start: teleRange.start, end: teleRange.start } }))
									continue;

								foundTeleport = true;

								await withTeleports(teleport.document, teleRange.start, originDefinition ?? definition);
							}
						}

						if (!foundTeleport) {
							if (originDefinition) {
								result.push({
									...definition,
									originSelectionRange: originDefinition.originSelectionRange,
								});
							}
							else {
								result.push(definition);
							}
						}
					}
				}
			},
			(data, sourceMap) => data.map(link => {

				if (link.originSelectionRange && sourceMap) {

					const originSelectionRange = sourceMap.getSourceRange(link.originSelectionRange.start, link.originSelectionRange.end)?.[0];

					if (!originSelectionRange)
						return;

					link.originSelectionRange = originSelectionRange;
				}

				const targetSourceMap = context.documents.sourceMapFromEmbeddedDocumentUri(link.targetUri);

				if (targetSourceMap) {

					const targetRange = targetSourceMap.getSourceRange(link.targetRange.start, link.targetRange.end)?.[0];
					const targetSelectionRange = targetSourceMap.getSourceRange(link.targetSelectionRange.start, link.targetSelectionRange.end)?.[0];

					if (!targetSelectionRange)
						return;

					link.targetUri = targetSourceMap.sourceDocument.uri;
					link.targetRange = targetRange ?? targetSelectionRange; // loose range mapping to for template slots, slot properties
					link.targetSelectionRange = targetSelectionRange;
				}

				return link;
			}).filter(shared.notEmpty),
			arr => dedupe.withLocationLinks(arr.flat()),
		);
	};
}
