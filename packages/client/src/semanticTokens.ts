import * as vscode from 'vscode';
import type { LanguageClient } from 'vscode-languageclient/node';
import {
	SemanticTokensRequest,
	SemanticTokenLegendRequest,
	SemanticTokensChangedNotification,
} from '@volar/shared';

export async function registerDocumentSemanticTokensProvider(client: LanguageClient) {

	const onDidChangeSemanticTokensEvent = new vscode.EventEmitter<void>();
	await client.onReady();
	client.onNotification(SemanticTokensChangedNotification.type, () => {
		onDidChangeSemanticTokensEvent.fire();
	});

	class SemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
		onDidChangeSemanticTokens = onDidChangeSemanticTokensEvent.event;
		async provideDocumentSemanticTokens(document: vscode.TextDocument, token: vscode.CancellationToken) {
			const builder = new vscode.SemanticTokensBuilder();
			const tokens = await client.sendRequest(SemanticTokensRequest.type, {
				textDocument: client.code2ProtocolConverter.asTextDocumentIdentifier(document),
				range: { start: document.positionAt(0), end: document.positionAt(document.getText().length) },
			});
			for (const token of tokens) {
				builder.push(token[0], token[1], token[2], token[3], token[4] ?? undefined);
			}
			return builder.build();
		}
	}

	const _tokenLegend = await client.sendRequest(SemanticTokenLegendRequest.type);
	const tokenLegend = new vscode.SemanticTokensLegend(_tokenLegend.types, _tokenLegend.modifiers);
	vscode.languages.registerDocumentSemanticTokensProvider([{ scheme: 'file', language: 'vue' }], new SemanticTokensProvider(), tokenLegend);
}
