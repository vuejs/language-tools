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
import {
	TagCloseRequest,
	GetEmbeddedLanguageRequest,
	VerifyAllScriptsRequest,
	FormatAllScriptsRequest,
	SemanticTokensRequest,
	SemanticTokenLegendRequest,
} from '@volar/shared';
import {
	DocumentSemanticTokensProvider, CancellationToken,
	languages, SemanticTokensLegend, SemanticTokensBuilder
} from 'vscode';

let apiClient: LanguageClient;
let docClient: LanguageClient;

export async function activate(context: vscode.ExtensionContext) {
	// from typescript
	vscode.languages.setLanguageConfiguration('vue', {
		wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
		indentationRules: {
			decreaseIndentPattern: /^((?!.*?\/\*).*\*\/)?\s*[\}\]].*$/,
			increaseIndentPattern: /^((?!\/\/).)*(\{[^}"'`]*|\([^)"'`]*|\[[^\]"'`]*)$/
		},
	});

	apiClient = setupLanguageService(context, path.join('packages', 'server', 'out', 'server.js'), 'Volar - Basic', 6009);
	docClient = setupLanguageService(context, path.join('packages', 'server', 'out', 'documentServer.js'), 'Volar - Document', 6010);

	context.subscriptions.push(activateTagClosing(tagRequestor, { vue: true }, 'html.autoClosingTags'));
	context.subscriptions.push(activateCommenting(embeddedLanguageRequestor));
	context.subscriptions.push(vscode.commands.registerCommand('volar.action.verifyAllScripts', () => {
		docClient.sendRequest(VerifyAllScriptsRequest.type, undefined);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('volar.action.formatAllScripts', () => {
		apiClient.sendRequest(FormatAllScriptsRequest.type, undefined);
	}));

	await docClient.onReady();
	const _tokenLegend = await docClient.sendRequest(SemanticTokenLegendRequest.type);
	const tokenLegend = new SemanticTokensLegend(_tokenLegend.types, _tokenLegend.modifiers);
	languages.registerDocumentSemanticTokensProvider([{ scheme: 'file', language: 'vue' }], new SemanticTokensProvider(), tokenLegend);

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

function setupLanguageService(context: vscode.ExtensionContext, script: string, name: string, port: number) {
	// The server is implemented in node
	let serverModule = context.asAbsolutePath(script);
	// The debug options for the server
	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	let debugOptions = { execArgv: ['--nolazy', '--inspect=' + port] };

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

class SemanticTokensProvider implements DocumentSemanticTokensProvider {
	onDidChangeSemanticTokens?: import("vscode").Event<void> | undefined;
	async provideDocumentSemanticTokens(document: TextDocument, token: CancellationToken) {
		const builder = new SemanticTokensBuilder();
		const tokens = await docClient.sendRequest(SemanticTokensRequest.type, {
			textDocument: docClient.code2ProtocolConverter.asTextDocumentIdentifier(document),
			range: { start: document.positionAt(0), end: document.positionAt(document.getText().length) },
		});
		for (const token of tokens) {
			builder.push(token[0], token[1], token[2], token[3], token[4] ?? undefined);
		}
		return builder.build();
	}
}
