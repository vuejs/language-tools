import { GetDragAndDragImportEditsRequest } from '@vue/language-server';
import * as vscode from 'vscode';
import type { BaseLanguageClient } from 'vscode-languageclient';

export async function register(_context: vscode.ExtensionContext, client: BaseLanguageClient) {
	vscode.languages.registerDocumentDropEditProvider(
		{ language: 'vue' },
		{
			async provideDocumentDropEdits(document, _position, dataTransfer) {
				for (const [mimeType, item] of dataTransfer) {
					if (mimeType === 'text/uri-list') {
						const uri = item.value as string;
						if (uri.endsWith('.vue')) {
							let tagName = uri.substring(uri.lastIndexOf('/') + 1);
							tagName = tagName.substring(0, tagName.lastIndexOf('.'));
							const edits = await client.sendRequest(GetDragAndDragImportEditsRequest.type, {
								uri: document.uri.toString(),
								importUri: uri,
								tagName,
							});
							const additionalEdit = new vscode.WorkspaceEdit();
							for (const edit of edits ?? []) {
								additionalEdit.replace(
									document.uri,
									new vscode.Range(
										edit.range.start.line,
										edit.range.start.character,
										edit.range.end.line,
										edit.range.end.character,
									),
									edit.newText
								);
							}
							return {
								insertText: new vscode.SnippetString(`<${tagName}$0 />`),
								additionalEdit,
							};
						}
					}
				}
			},
		}
	);
}
