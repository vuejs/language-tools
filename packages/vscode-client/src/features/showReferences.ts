import * as vscode from 'vscode';
import { ShowReferencesNotification } from '@volar/shared';
import type { LanguageClient } from 'vscode-languageclient/node';

export async function activate(context: vscode.ExtensionContext, languageClient: LanguageClient) {
    await languageClient.onReady();
    context.subscriptions.push(languageClient.onNotification(ShowReferencesNotification.type, handler => {
        const uri = handler.uri;
        const pos = handler.position;
        const refs = handler.references;
        vscode.commands.executeCommand(
            'editor.action.showReferences',
            vscode.Uri.parse(uri),
            new vscode.Position(pos.line, pos.character),
            refs.map(ref => new vscode.Location(
                vscode.Uri.parse(ref.uri),
                new vscode.Range(ref.range.start.line, ref.range.start.character, ref.range.end.line, ref.range.end.character),
            )),
        );
    }));
}
