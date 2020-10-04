/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import * as vscode from 'vscode';
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind,
	TextDocumentIdentifier,
} from 'vscode-languageclient';
import {
	TextDocument,
} from 'vscode';
import { activateTagClosing } from './tagClosing';
import { activateCommenting } from './commenting';
import { TagCloseRequest, GetEmbeddedLanguageRequest } from '@volar/shared';

let apiClient: LanguageClient;
let docClient: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
	apiClient = setupLanguageService(context, path.join('packages', 'server', 'out', 'server.js'), 'Volar - Basic');
	docClient = setupLanguageService(context, path.join('packages', 'server', 'out', 'documentServer.js'), 'Volar - Document');

	context.subscriptions.push(activateTagClosing(tagRequestor, { vue: true }, 'html.autoClosingTags'));
	context.subscriptions.push(activateCommenting(embeddedLanguageRequestor));

	function tagRequestor(document: TextDocument, position: vscode.Position) {
		let param = apiClient.code2ProtocolConverter.asTextDocumentPositionParams(document, position);
		return apiClient.sendRequest(TagCloseRequest.type, param);
	}
	function embeddedLanguageRequestor(document: TextDocument, range: vscode.Range) {
		return apiClient.sendRequest(GetEmbeddedLanguageRequest.type, {
			textDocument: TextDocumentIdentifier.create(document.uri.toString()),
			range: range,
		});
	}
}

export function deactivate(): Thenable<void> | undefined {
	return apiClient?.stop() && docClient?.stop();
}

function setupLanguageService(context: vscode.ExtensionContext, script: string, name: string,) {
	// The server is implemented in node
	let serverModule = context.asAbsolutePath(script);
	// The debug options for the server
	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	let serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		},
	};

	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [
			{ scheme: 'file', language: 'vue' },
			{ scheme: 'file', language: 'typescript' },
			// { scheme: 'file', language: 'javascript' },
		],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
		},
	};


	// Create the language client and start the client.
	const client = new LanguageClient(
		name,
		serverOptions,
		clientOptions
	);

	// Start the client. This will also launch the server
	client.start();

	return client;
}
