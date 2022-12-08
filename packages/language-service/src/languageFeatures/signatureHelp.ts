import type * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import { languageFeatureWorker } from '../utils/featureWorkers';

export function register(context: LanguageServiceRuntimeContext) {

	return (uri: string, position: vscode.Position, signatureHelpContext?: vscode.SignatureHelpContext) => {

		return languageFeatureWorker(
			context,
			uri,
			position,
			(position, sourceMap) => sourceMap.toGeneratedPositions(position, data => !!data.completion),
			(plugin, document, position) => plugin.getSignatureHelp?.(document, position, signatureHelpContext),
			(data) => data,
		);
	};
}
