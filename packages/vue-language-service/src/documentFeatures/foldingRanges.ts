import type { DocumentServiceRuntimeContext } from '../types';
import { documentFeatureWorker } from '../utils/featureWorkers';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { transformFoldingRanges } from '@volar/transforms';
import type * as _ from 'vscode-languageserver-protocol';

export function register(context: DocumentServiceRuntimeContext) {

	return (document: TextDocument) => {

		return documentFeatureWorker(
			context,
			document,
			sourceMap => sourceMap.embeddedFile.capabilities.foldingRanges,
			(plugin, document) => plugin.getFoldingRanges?.(document),
			(data, sourceMap) => transformFoldingRanges(
				data,
				range => {

					if (!sourceMap)
						return range;

					return sourceMap.getSourceRange(range.start, range.end)?.[0]
				},
			),
			arr => arr.flat(),
		);
	}
}
