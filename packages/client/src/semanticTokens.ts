import * as vscode from 'vscode';
import type { LanguageClient } from 'vscode-languageclient';
import {
	SemanticTokensRequest,
	SemanticTokenLegendRequest,
} from '@volar/shared';

export async function registerDocumentSemanticTokensProvider(client: LanguageClient) {

	class SemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
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

	await client.onReady();
	const _tokenLegend = await client.sendRequest(SemanticTokenLegendRequest.type);
	const tokenLegend = new vscode.SemanticTokensLegend(_tokenLegend.types, _tokenLegend.modifiers);
	vscode.languages.registerDocumentSemanticTokensProvider([{ scheme: 'file', language: 'vue' }], new SemanticTokensProvider(), tokenLegend);
}
