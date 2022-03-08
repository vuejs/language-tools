import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import { languageFeatureWorker } from '../utils/featureWorkers';

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
					data => !!data.capabilities.rename,
				)) {
					yield mapedRange.start;
				}
			},
			(plugin, document, position) => plugin.doRenamePrepare?.(document, position),
			(data, sourceMap) => {

				if (sourceMap && vscode.Range.is(data))
					return sourceMap.getSourceRange(data.start, data.end)?.[0];

				return data;
			},
		);
	}
}
