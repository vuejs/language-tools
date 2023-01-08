import type { LanguageServiceRuntimeContext } from '../types';
import { documentFeatureWorker } from '../utils/featureWorkers';
import * as transformer from '../transformer';
import type * as _ from 'vscode-languageserver-protocol';

export function register(context: LanguageServiceRuntimeContext) {

	return (uri: string) => {

		return documentFeatureWorker(
			context,
			uri,
			file => !!file.capabilities.foldingRange,
			(plugin, document) => plugin.getFoldingRanges?.(document),
			(data, map) => map ? transformer.asFoldingRanges(data, range => map.toSourceRange(range)) : data,
			arr => arr.flat(),
		);
	};
}
