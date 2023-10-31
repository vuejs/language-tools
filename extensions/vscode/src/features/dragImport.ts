import { GetDragAndDragImportEditsRequest, TagNameCasing } from '@vue/language-server';
import * as vscode from 'vscode';
import type { BaseLanguageClient, DocumentFilter, InsertTextFormat } from 'vscode-languageclient';
import { tagNameCasings } from './nameCasing';
import { config } from '../config';

export async function register(context: vscode.ExtensionContext, client: BaseLanguageClient) {

	const selectors: DocumentFilter[] = [{ language: 'vue' }];

	if (config.server.petiteVue.supportHtmlFile) {
		selectors.push({ language: 'html' });
	}
	if (config.server.vitePress.supportMdFile) {
		selectors.push({ language: 'markdown' });
	}

	context.subscriptions.push(
		vscode.languages.registerDocumentDropEditProvider(
			selectors,
			{
				async provideDocumentDropEdits(document, _position, dataTransfer) {
					for (const [mimeType, item] of dataTransfer) {
						if (mimeType === 'text/uri-list') {
							const uri = item.value as string;
							if (
								uri.endsWith('.vue')
								|| (uri.endsWith('.md') && config.server.vitePress.supportMdFile)
							) {
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
		),
	);
}
