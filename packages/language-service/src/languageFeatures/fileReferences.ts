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
			(data, sourceMap) => data.map(reference => {

				const referenceSourceMap = context.documents.sourceMapFromEmbeddedDocumentUri(reference.uri);

				if (referenceSourceMap) {

					const start = referenceSourceMap.toSourcePosition(reference.range.start)?.[0];
					const end = referenceSourceMap.toSourcePosition(reference.range.end)?.[0];

					if (!start || !end)
						return;

					reference.uri = referenceSourceMap.sourceDocument.uri;
					reference.range = { start, end };
				}

				return reference;
			}).filter(shared.notEmpty),
			arr => dedupe.withLocations(arr.flat()),
		);
	};
}
