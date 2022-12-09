import * as vscode from 'vscode';
import { BaseLanguageClient, State } from 'vscode-languageclient';
import { FsReadDirectoryRequest, FsReadFileRequest, FsStatRequest } from '@volar/language-server';

export async function register(context: vscode.ExtensionContext, client: BaseLanguageClient) {

	addHandle();

	client.onDidChangeState(() => {
		if (client.state === State.Running) {
			addHandle();
		}
	});

	function addHandle() {
		context.subscriptions.push(client.onRequest(FsStatRequest.type, async uri => {
			try {
				return await vscode.workspace.fs.stat(client.protocol2CodeConverter.asUri(uri));
			}
			catch {
				return undefined;
			}
		}));

		context.subscriptions.push(client.onRequest(FsReadFileRequest.type, async uri => {
			try {
				const data = await vscode.workspace.fs.readFile(client.protocol2CodeConverter.asUri(uri));
				return new TextDecoder('utf8').decode(data);
			}
			catch {
				return undefined;
			}
		}));

		context.subscriptions.push(client.onRequest(FsReadDirectoryRequest.type, async uri => {
			try {
				return await vscode.workspace.fs.readDirectory(client.protocol2CodeConverter.asUri(uri));
			}
			catch {
				return [];
			}
		}));
	}
}
