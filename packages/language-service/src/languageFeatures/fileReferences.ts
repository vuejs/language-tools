import type { LanguageServiceRuntimeContext } from '../types';
import * as shared from '@volar/shared';
import { languageFeatureWorker } from '../utils/featureWorkers';
import * as dedupe from '../utils/dedupe';
import * as vscode from 'vscode-languageserver-protocol';
import { NullableResult } from '@volar/language-service';

export function register(context: LanguageServiceRuntimeContext) {

	return (uri: string): NullableResult<vscode.Location[]> => {

		return languageFeatureWorker(
			context,
			uri,
			undefined,
			function* (_) {
				yield _;
			},
			async (plugin, document) => {
				return await plugin.findFileReferences?.(document) ?? [];
			},
			(data) => data.map(reference => {

				if (!context.documents.hasVirtualFileByUri(reference.uri)) {
					return reference;
				}

				for (const [_, map] of context.documents.getMapsByVirtualFileUri(reference.uri)) {
					const range = map.toSourceRange(reference.range);
					if (range) {
						reference.uri = map.sourceFileDocument.uri;
						reference.range = range;
						return reference;
					}
				}
			}).filter(shared.notEmpty),
			arr => dedupe.withLocations(arr.flat()),
		);
	};
}
