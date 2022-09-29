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
			function* (position, sourceMap) {
				for (const mapped of sourceMap.toGeneratedPositions(position)) {
					if (isValidMappingData(mapped[1].data)) {
						yield mapped[0];
					}
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

					const targetSelectionRangeStart = targetSourceMap.toSourcePosition(link.targetSelectionRange.start)?.[0];
					const targetSelectionRangeEnd = targetSourceMap.toSourcePosition(link.targetSelectionRange.end)?.[0];

					if (!targetSelectionRangeStart || !targetSelectionRangeEnd)
						return;

					let targetRangeStart = targetSourceMap.toSourcePosition(link.targetRange.start)?.[0];
					let targetRangeEnd = targetSourceMap.toSourcePosition(link.targetRange.end)?.[0];

					link.targetUri = targetSourceMap.sourceDocument.uri;
					link.targetRange = {
						// loose range mapping to for template slots, slot properties
						start: targetRangeStart ?? targetSelectionRangeStart,
						end: targetRangeEnd ?? targetSelectionRangeEnd,
					};
					link.targetSelectionRange = {
						start: targetSelectionRangeStart,
						end: targetSelectionRangeEnd,
					};
				}

				return link;
			}).filter(shared.notEmpty),
			arr => dedupe.withLocationLinks(arr.flat()),
		);
	};
}

function toSourcePositionPreferSurroundedPosition(sourceMap: EmbeddedDocumentSourceMap, mappedRange: vscode.Range, position: vscode.Position) {

	let result: vscode.Range | undefined;

	for (const mapped of sourceMap.toSourcePositions(mappedRange.start)) {
		const start = mapped[0];
		const end = sourceMap.matchSourcePosition(mapped[0], mapped[1], 'right') ?? sourceMap.toSourcePosition(mappedRange.end, 'right')?.[0];
		if (!end)
			continue;
		if (!result) {
			result = { start, end };
		}
		if (
			(start.line < position.line || (start.line === position.line && start.character <= position.character))
			&& (end.line > position.line || (end.line === position.line && end.character >= position.character))
		) {
			return { start, end };
		}
	}

	return result;
}
