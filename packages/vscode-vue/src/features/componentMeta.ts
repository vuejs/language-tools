import * as vscode from 'vscode';
import type { BaseLanguageClient } from 'vscode-languageclient';
import { GetComponentMeta } from '@vue/language-server';

const scheme = 'vue-component-meta';

export async function register(context: vscode.ExtensionContext, client: BaseLanguageClient) {

	const sourceUriToMetaUri = new Map<string, string>();
	const metaUriToSourceEditor = new Map<string, vscode.TextEditor>();
	const docChangeEvent = new vscode.EventEmitter<vscode.Uri>();
	let updateVirtualDocument: NodeJS.Timeout | undefined;

	context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => {
		const uri = sourceUriToMetaUri.get(e.document.uri.toString());
		if (uri) {
			clearTimeout(updateVirtualDocument);
			updateVirtualDocument = setTimeout(() => {
				docChangeEvent.fire(vscode.Uri.parse(uri));
			}, 100);
		}
	}));
	context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(
		scheme,
		{
			onDidChange: docChangeEvent.event,
			async provideTextDocumentContent(uri: vscode.Uri): Promise<string | undefined> {

				const sourceUri = metaUriToSourceEditor.get(uri.toString());

				if (sourceUri) {

					const meta = await client.sendRequest(GetComponentMeta.type, { uri: sourceUri.document.uri.toString() });

					return JSON.stringify(meta, undefined, '\t');
				}
			}
		},
	));
	context.subscriptions.push(vscode.commands.registerCommand('volar.action.showComponentMeta', async () => {
		const sourceEditor = vscode.window.activeTextEditor;
		if (sourceEditor) {
			const metaUri = sourceEditor.document.uri.with({ scheme }).toString() + '.meta.json';
			sourceUriToMetaUri.set(sourceEditor.document.uri.toString(), metaUri);
			metaUriToSourceEditor.set(metaUri, sourceEditor);
			vscode.window.showTextDocument(vscode.Uri.parse(metaUri), { viewColumn: vscode.ViewColumn.Two, preview: false });
		}
	}));
}
