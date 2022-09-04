import * as vscode from 'vscode';
import type { BaseLanguageClient } from 'vscode-languageclient';
import { FsReadDirectoryRequest, FsReadFileRequest, FsStatRequest } from '@volar/vue-language-server';

export async function activate(context: vscode.ExtensionContext, languageClient: BaseLanguageClient) {

	context.subscriptions.push(languageClient.onRequest(FsStatRequest.type, async uri => {
		try {
			return await vscode.workspace.fs.stat(languageClient.protocol2CodeConverter.asUri(uri));
		}
		catch {
			return undefined;
		}
	}));

	context.subscriptions.push(languageClient.onRequest(FsReadFileRequest.type, async uri => {
		try {
			const data = await vscode.workspace.fs.readFile(languageClient.protocol2CodeConverter.asUri(uri));
			return new TextDecoder('utf8').decode(data);
		}
		catch {
			return undefined;
		}
	}));

	context.subscriptions.push(languageClient.onRequest(FsReadDirectoryRequest.type, async uri => {
		try {
			return await vscode.workspace.fs.readDirectory(languageClient.protocol2CodeConverter.asUri(uri));
		}
		catch {
			return [];
		}
	}));
}
