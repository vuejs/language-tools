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
				for (const mapped of sourceMap.toGeneratedPositions(position)) {
					if (mapped[1].data.completion) {
						yield mapped[0];
					}
				}
			},
			(plugin, document, position) => plugin.getSignatureHelp?.(document, position, signatureHelpContext),
			(data, sourceMap) => data,
		);
	};
}
