import type * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import { languageFeatureWorker } from '../utils/featureWorkers';

export function register(context: LanguageServiceRuntimeContext) {

	return (uri: string, position: vscode.Position, signatureHelpContext?: vscode.SignatureHelpContext) => {

		return languageFeatureWorker(
			context,
			uri,
			position,
			function* (position, sourceMap) {
				for (const [mappedRange] of sourceMap.getMappedRanges(
					position,
					position,
					data => !!data.capabilities.completion,
				)) {
					yield mappedRange.start;
				}
			},
			(plugin, document, position) => plugin.getSignatureHelp?.(document, position, signatureHelpContext),
			(data, sourceMap) => data,
		);
	}
}
