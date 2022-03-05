import type * as vscode from 'vscode-languageserver-protocol';
import { visitEmbedded } from '../plugins/definePlugin';
import type { LanguageServiceRuntimeContext } from '../types';

export function register(context: LanguageServiceRuntimeContext) {

	return async (uri: string, position: vscode.Position, signatureHelpContext?: vscode.SignatureHelpContext) => {

		const document = context.getTextDocument(uri);
		const vueDocument = context.sourceFiles.get(uri);

		let signatureHelp: vscode.SignatureHelp | undefined;

		if (vueDocument) {

			const embeddeds = vueDocument.getEmbeddeds();

			await visitEmbedded(embeddeds, async sourceMap => {

				for (const [mapedRange] of sourceMap.getMappedRanges(
					position,
					position,
					data => !!data.capabilities.completion,
				)) {

					const plugins = context.getPlugins(sourceMap.lsType);

					for (const plugin of plugins) {

						if (!plugin.getSignatureHelp)
							continue;

						const _signatureHelp = await plugin.getSignatureHelp(sourceMap.mappedDocument, mapedRange.start, signatureHelpContext);

						if (_signatureHelp) {
							signatureHelp = _signatureHelp;
							return false;
						}
					}
				}

				return true;
			});
		}

		if (!signatureHelp && document) {

			const plugins = context.getPlugins('script');

			for (const plugin of plugins) {

				if (!plugin.getSignatureHelp)
					continue;

				const _signatureHelp = await plugin.getSignatureHelp(document, position, signatureHelpContext);

				if (_signatureHelp) {
					signatureHelp = _signatureHelp;
					break;
				}
			}
		}

		return signatureHelp;
	}
}
