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
			(data, map) => map ? transformFoldingRanges(data, range => map.toSourceRange(range)) : data,
			arr => arr.flat(),
		);
	};
}
