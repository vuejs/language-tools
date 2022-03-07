import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import * as shared from '@volar/shared';
import { languageFeatureWorker } from '../utils/featureWorkers';
import * as dedupe from '../utils/dedupe';

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
			(plugin, document, position) => plugin.findImplementations?.(document, position),
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
