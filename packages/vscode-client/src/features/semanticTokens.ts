import * as vscode from 'vscode';
import * as shared from '@volar/shared';
import type { LanguageClient } from 'vscode-languageclient/node';

export async function activate(context: vscode.ExtensionContext, languageClient: LanguageClient) {
	await languageClient.onReady();
	const tokenLegend = await languageClient.sendRequest(shared.SemanticTokenLegendRequest.type);

	const onDidChangeSemanticTokensEvent = new vscode.EventEmitter<void>();
	languageClient.onNotification(shared.SemanticTokensChangedNotification.type, () => {
		onDidChangeSemanticTokensEvent.fire();
	});

	class RangeSemanticTokensProvider implements vscode.DocumentRangeSemanticTokensProvider {
		onDidChangeSemanticTokens = onDidChangeSemanticTokensEvent.event;
		async provideDocumentRangeSemanticTokens(document: vscode.TextDocument, range: vscode.Range, token: vscode.CancellationToken) {
			const result = await languageClient.sendRequest(shared.RangeSemanticTokensRequest.type, {
				textDocument: languageClient.code2ProtocolConverter.asTextDocumentIdentifier(document),
				range: languageClient.code2ProtocolConverter.asRange(range),
			});
			if (!result) {
				return { data: new Uint32Array() };
			}
			return languageClient.protocol2CodeConverter.asSemanticTokens(result);
		}
	}

	context.subscriptions.push(vscode.languages.registerDocumentRangeSemanticTokensProvider([{ scheme: 'file', language: 'vue' }], new RangeSemanticTokensProvider(), tokenLegend));
}
