import * as vscode from 'vscode';
import type { LanguageClient } from 'vscode-languageclient/node';
import {
    RangeSemanticTokensRequest,
    SemanticTokenLegendRequest,
    SemanticTokensChangedNotification,
} from '@volar/shared';

export async function registerDocumentSemanticTokensProvider(client: LanguageClient) {

    const onDidChangeSemanticTokensEvent = new vscode.EventEmitter<void>();
    await client.onReady();
    client.onNotification(SemanticTokensChangedNotification.type, () => {
        onDidChangeSemanticTokensEvent.fire();
    });

    class RangeSemanticTokensProvider implements vscode.DocumentRangeSemanticTokensProvider {
        onDidChangeSemanticTokens = onDidChangeSemanticTokensEvent.event;
        async provideDocumentRangeSemanticTokens(document: vscode.TextDocument, range: vscode.Range, token: vscode.CancellationToken) {
            const result = await client.sendRequest(RangeSemanticTokensRequest.type, {
                textDocument: client.code2ProtocolConverter.asTextDocumentIdentifier(document),
                range: client.code2ProtocolConverter.asRange(range),
            });
            if (!result) {
                return { data: new Uint32Array() };
            }
            return client.protocol2CodeConverter.asSemanticTokens(result);
        }
    }

    const tokenLegend = await client.sendRequest(SemanticTokenLegendRequest.type);
    return vscode.languages.registerDocumentRangeSemanticTokensProvider([{ scheme: 'file', language: 'vue' }], new RangeSemanticTokensProvider(), tokenLegend);
}
