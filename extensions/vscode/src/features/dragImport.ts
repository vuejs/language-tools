import { GetDragAndDragImportEditsRequest, TagNameCasing } from '@vue/language-server';
import * as vscode from 'vscode';
import type { BaseLanguageClient, InsertTextFormat } from 'vscode-languageclient';
import { tagNameCasings } from './nameCasing';

export async function register(_context: vscode.ExtensionContext, client: BaseLanguageClient) {
	vscode.languages.registerDocumentDropEditProvider(
		{ language: 'vue' },
		{
			async provideDocumentDropEdits(document, _position, dataTransfer) {
				for (const [mimeType, item] of dataTransfer) {
					if (mimeType === 'text/uri-list') {
						const uri = item.value as string;
						if (uri.endsWith('.vue')) {
							const response = await client.sendRequest(GetDragAndDragImportEditsRequest.type, {
								uri: document.uri.toString(),
								importUri: uri,
								casing: tagNameCasings.get(document.uri.toString()) ?? TagNameCasing.Pascal,
							});
							if (!response) {
								return;
							}
							const additionalEdit = new vscode.WorkspaceEdit();
							for (const edit of response.additionalEdits) {
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
								insertText: response.insertTextFormat === 2 satisfies typeof InsertTextFormat.Snippet
									? new vscode.SnippetString(response.insertText)
									: response.insertText,
								additionalEdit,
							};
						}
					}
				}
			},
		}
	);
}
