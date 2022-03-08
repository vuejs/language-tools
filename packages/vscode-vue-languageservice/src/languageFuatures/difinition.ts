import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import * as shared from '@volar/shared';
import { languageFeatureWorker } from '../utils/featureWorkers';
import * as dedupe from '../utils/dedupe';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { EmbeddedDocumentMappingData, TeleportSideData } from '@volar/vue-typescript';

export function register(
	context: LanguageServiceRuntimeContext,
	api: 'findDefinition' | 'findTypeDefinition' | 'findImplementations',
	isValidMappingData: (data: EmbeddedDocumentMappingData) => boolean,
	isValidTeleportSideData: (sideData: TeleportSideData) => boolean,
) {

	return (uri: string, position: vscode.Position) => {

		return languageFeatureWorker(
			context,
			uri,
			position,
			function* (position, sourceMap) {
				for (const [mapedRange] of sourceMap.getMappedRanges(
					position,
					position,
					isValidMappingData,
				)) {
					yield mapedRange.start;
				}
			},
			async (plugin, document, position, sourceMap) => {

				const recursiveChecker = dedupe.createLocationSet();
				const result: vscode.LocationLink[] = [];

				await withTeleports(document, position, undefined);

				return result;

				async function withTeleports(document: TextDocument, position: vscode.Position, originDifinition: vscode.LocationLink | undefined) {

					if (!plugin[api])
						return;

					if (recursiveChecker.has({ uri: document.uri, range: { start: position, end: position } }))
						return;

					recursiveChecker.add({ uri: document.uri, range: { start: position, end: position } });

					const difinitions = await plugin[api]?.(document, position) ?? [];

					for (const difinition of difinitions) {

						let foundTeleport = false;

						if (sourceMap?.lsType !== 'nonTs') {

							recursiveChecker.add({ uri: difinition.targetUri, range: { start: difinition.targetRange.start, end: difinition.targetRange.start } });

							const teleport = context.vueDocuments.getTsTeleports(sourceMap?.lsType ?? 'script').get(difinition.targetUri);

							if (teleport) {

								for (const [teleRange] of teleport.findTeleports(
									difinition.targetSelectionRange.start,
									difinition.targetSelectionRange.end,
									isValidTeleportSideData,
								)) {

									if (recursiveChecker.has({ uri: teleport.document.uri, range: { start: teleRange.start, end: teleRange.start } }))
										continue;

									foundTeleport = true;

									await withTeleports(teleport.document, teleRange.start, difinition);
								}
							}
						}

						if (!foundTeleport) {
							if (originDifinition) {
								result.push({
									...difinition,
									originSelectionRange: originDifinition.originSelectionRange,
								});
							}
							else {
								result.push(difinition);
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

				const targetSourceMap = context.vueDocuments.fromEmbeddedDocumentUri(sourceMap?.lsType ?? 'script', link.targetUri);

				if (targetSourceMap) {

					const targetRange = targetSourceMap.getSourceRange(link.targetRange.start, link.targetRange.end)?.[0];
					const targetSelectionRange = targetSourceMap.getSourceRange(link.targetSelectionRange.start, link.targetSelectionRange.end)?.[0];

					if (!targetRange || !targetSelectionRange)
						return;

					link.targetUri = targetSourceMap.sourceDocument.uri;
					link.targetRange = targetRange;
					link.targetSelectionRange = targetSelectionRange;
				}

				return link;
			}).filter(shared.notEmpty),
			arr => dedupe.withLocationLinks(arr.flat()),
		);
	}
}
