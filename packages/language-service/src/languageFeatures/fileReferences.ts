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

				const map = context.documents.getMap(reference.uri);
				if (!map) {
					return reference;
				}

				if (map) {
					const range = map.toSourceRange(reference.range);
					if (range) {
						reference.uri = map.sourceDocument.uri;
						reference.range = range;
						return reference;
					}
				}
			}).filter(shared.notEmpty),
			arr => dedupe.withLocations(arr.flat()),
		);
	};
}
