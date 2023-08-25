import { createConnection, startLanguageServer } from '@volar/language-server/node';
import { createServerPlugin } from './languageServerPlugin';
import * as vscode from 'vscode-languageserver/node';

let connection: vscode.Connection;
if (process.argv.includes('--stdio')) {
	console.log = (...args: any[]) => console.warn(...args);
	connection = vscode.createConnection(process.stdin, process.stdout);
} else {
	connection = createConnection();
}

const plugin = createServerPlugin(connection);

startLanguageServer(connection, plugin);
