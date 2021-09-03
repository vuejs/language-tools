import * as vscode from 'vscode';
import * as shared from '@volar/shared';
import { LanguageClient } from 'vscode-languageclient/node';

class TypeScriptInlayHintsProvider implements vscode.InlayHintsProvider {

	constructor(
		private readonly client: LanguageClient,
	) { }

	async provideInlayHints(model: vscode.TextDocument, range: vscode.Range, _token: vscode.CancellationToken): Promise<vscode.InlayHint[]> {

		const inlayHints = await this.client.sendRequest(shared.GetInlayHintsRequest.type, {
			textDocument: this.client.code2ProtocolConverter.asTextDocumentIdentifier(model),
			range: this.client.code2ProtocolConverter.asRange(range),
		});

		if (!inlayHints)
			return [];

		return inlayHints.map(hint => {
			const result = new vscode.InlayHint(
				hint.text,
				this.client.protocol2CodeConverter.asPosition(hint.position),
				hint.kind,
			);
			result.whitespaceBefore = hint.whitespaceBefore;
			result.whitespaceAfter = hint.whitespaceAfter;
			return result;
		});
	}
}

function register(
	selector: vscode.DocumentSelector,
	client: LanguageClient,
) {
	return vscode.languages.registerInlayHintsProvider(selector,
		new TypeScriptInlayHintsProvider(client));
}

export async function activate(
	context: vscode.ExtensionContext,
	client: LanguageClient,
) {
	await client.onReady();
	context.subscriptions.push(register([{ scheme: 'file', language: 'vue' }], client))
}
