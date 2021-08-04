import type * as vscode from 'vscode-languageserver';
import * as shared from '@volar/shared';

export function execute(uri: string, position: vscode.Position, references: vscode.Location[], connection: vscode.Connection) {
	connection.sendNotification(shared.ShowReferencesNotification.type, { textDocument: { uri }, position, references });
}
