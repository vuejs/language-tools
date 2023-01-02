import type { LanguageServiceRuntimeContext } from '../types';
import { documentFeatureWorker } from '../utils/featureWorkers';
import { transformFoldingRanges } from '@volar/transforms';
import type * as _ from 'vscode-languageserver-protocol';

export function register(context: LanguageServiceRuntimeContext) {

	return (uri: string) => {

		return documentFeatureWorker(
			context,
			uri,
			file => !!file.capabilities.foldingRange,
			(plugin, document) => plugin.getFoldingRanges?.(document),
			(data, sourceMap) => transformFoldingRanges(data, range => sourceMap?.toSourceRange(range)),
			arr => arr.flat(),
		);
	};
}
