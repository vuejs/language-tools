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
			function* (_, sourceMap) {
				yield _;
			},
			async (plugin, document, _, sourceMap, vueDocument) => {
				return await plugin.findFileReferences?.(document) ?? [];
			},
			(data, sourceMap) => data.map(reference => {

				const referenceSourceMap = context.documents.sourceMapFromEmbeddedDocumentUri(reference.uri);

				if (referenceSourceMap) {

					const range = referenceSourceMap.getSourceRange(
						reference.range.start,
						reference.range.end,
						data => !!data.references,
					)?.[0];

					if (!range)
						return;

					reference.uri = referenceSourceMap.sourceDocument.uri;
					reference.range = range;
				}

				return reference;
			}).filter(shared.notEmpty),
			arr => dedupe.withLocations(arr.flat()),
		);
	};
}
