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
			map => !!map.file.capabilities.foldingRange,
			(plugin, document) => plugin.getFoldingRanges?.(document),
			(data, sourceMap) => transformFoldingRanges(data, range => sourceMap?.toSourceRange(range)),
			arr => arr.flat(),
		);
	};
}
