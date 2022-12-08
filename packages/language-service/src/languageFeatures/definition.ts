import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import * as shared from '@volar/shared';
import { languageFeatureWorker } from '../utils/featureWorkers';
import * as dedupe from '../utils/dedupe';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { PositionCapabilities, TeleportCapabilities } from '@volar/language-core';
import { EmbeddedDocumentSourceMap } from '../documents';

export function register(
	context: LanguageServiceRuntimeContext,
	api: 'findDefinition' | 'findTypeDefinition' | 'findImplementations',
	isValidMappingData: (data: PositionCapabilities) => boolean,
	isValidTeleportSideData: (sideData: TeleportCapabilities) => boolean,
) {

	return (uri: string, position: vscode.Position) => {

		return languageFeatureWorker(
			context,
			uri,
			position,
			(position, sourceMap) => sourceMap.toGeneratedPositions(position, isValidMappingData),
			async (plugin, document, position) => {

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

							for (const mapped of teleport.findTeleports(definition.targetSelectionRange.start)) {

								if (!isValidTeleportSideData(mapped[1]))
									continue;

								if (recursiveChecker.has({ uri: teleport.document.uri, range: { start: mapped[0], end: mapped[0] } }))
									continue;

								foundTeleport = true;

								await withTeleports(teleport.document, mapped[0], originDefinition ?? definition);
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

					const originSelectionRange = toSourcePositionPreferSurroundedPosition(sourceMap, link.originSelectionRange, position);

					if (!originSelectionRange)
						return;

					link.originSelectionRange = originSelectionRange;
				}

				const targetSourceMap = context.documents.sourceMapFromEmbeddedDocumentUri(link.targetUri);

				if (targetSourceMap) {

					const targetSelectionRange = targetSourceMap.toSourceRange(link.targetSelectionRange);
					if (!targetSelectionRange)
						return;

					let targetRange = targetSourceMap.toSourceRange(link.targetRange);

					link.targetUri = targetSourceMap.sourceDocument.uri;
					// loose range mapping to for template slots, slot properties
					link.targetRange = targetRange ?? targetSelectionRange;
					link.targetSelectionRange = targetSelectionRange;
				}

				return link;
			}).filter(shared.notEmpty),
			arr => dedupe.withLocationLinks(arr.flat()),
		);
	};
}

function toSourcePositionPreferSurroundedPosition(sourceMap: EmbeddedDocumentSourceMap, mappedRange: vscode.Range, position: vscode.Position) {

	let result: vscode.Range | undefined;

	for (const range of sourceMap.toSourceRanges(mappedRange)) {
		if (!result) {
			result = range;
		}
		if (
			(range.start.line < position.line || (range.start.line === position.line && range.start.character <= position.character))
			&& (range.end.line > position.line || (range.end.line === position.line && range.end.character >= position.character))
		) {
			return range;
		}
	}

	return result;
}
