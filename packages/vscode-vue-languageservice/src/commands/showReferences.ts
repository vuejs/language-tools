import type { Connection } from 'vscode-languageserver/node';
import type { Position } from 'vscode-languageserver/node';
import type { Location } from 'vscode-languageserver/node';
import { ShowReferencesNotification } from '@volar/shared';

export function execute(uri: string, position: Position, references: Location[], connection: Connection) {
	connection.sendNotification(ShowReferencesNotification.type, { uri, position, references });
}
