import * as vscode from 'vscode';
import { userPick } from './splitEditors';
import { LanguageClient } from 'vscode-languageclient/node';
import * as shared from '@volar/shared';

export async function activate(context: vscode.ExtensionContext, languageClient: LanguageClient) {

	await languageClient.onReady();

	while (await languageClient.sendRequest(shared.PingRequest.type) !== 'pong') {
		await shared.sleep(100);
	}

	languageClient.onRequest(shared.GetClientTagNameCaseRequest.type, async handler => {
		let tagCase = tagCases.get(handler.uri);
		if (tagCase === 'unsure') {
			const templateCases = await languageClient.sendRequest(shared.GetServerNameCasesRequest.type, handler);
			if (templateCases) {
				tagCase = templateCases.tag;
				tagCases.set(handler.uri, tagCase);
			}
		}
		if (handler.uri.toLowerCase() === vscode.window.activeTextEditor?.document.uri.toString().toLowerCase()) {
			updateStatusBarText(tagCase);
		}
		return !tagCase || tagCase === 'unsure' ? 'both' : tagCase;
	});

	const tagCases = new shared.UriMap<'both' | 'kebabCase' | 'pascalCase' | 'unsure'>();
	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
	statusBar.command = 'volar.action.tagNameCase';

	onChangeDocument(vscode.window.activeTextEditor?.document);
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(e => {
		onChangeDocument(e?.document);
	}));
	context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((doc) => {
		tagCases.delete(doc.uri.toString());
	}));
	context.subscriptions.push(vscode.commands.registerCommand('volar.action.tagNameCase', async () => {

		const crtDoc = vscode.window.activeTextEditor?.document;
		if (!crtDoc) return;

		const tagCase = tagCases.get(crtDoc.uri.toString());

		const options: Record<string, vscode.QuickPickItem> = {};

		options[0] = { label: (tagCase === 'both' ? '• ' : '') + 'Component Using kebab-case and PascalCase (Both)' };
		options[1] = { label: (tagCase === 'kebabCase' ? '• ' : '') + 'Component Using kebab-case' };
		options[2] = { label: (tagCase === 'pascalCase' ? '• ' : '') + 'Component Using PascalCase' };
		options[3] = { label: 'Detect Component name from Content' };
		options[7] = { label: 'Convert Component name to kebab-case' };
		options[8] = { label: 'Convert Component name to PascalCase' };

		const select = await userPick(options);
		if (select === undefined)
			return; // cancle

		if (select === '0') {
			tagCases.set(crtDoc.uri.toString(), 'both');
			updateStatusBarText('both');
		}
		if (select === '1') {
			tagCases.set(crtDoc.uri.toString(), 'kebabCase');
			updateStatusBarText('kebabCase');
		}
		if (select === '2') {
			tagCases.set(crtDoc.uri.toString(), 'pascalCase');
			updateStatusBarText('pascalCase');
		}
		if (select === '3') {
			const detects = await languageClient.sendRequest(shared.GetServerNameCasesRequest.type, languageClient.code2ProtocolConverter.asTextDocumentIdentifier(crtDoc));
			if (detects) {
				tagCases.set(crtDoc.uri.toString(), detects.tag);
				updateStatusBarText(detects.tag);
			}
		}
		if (select === '7') {
			vscode.commands.executeCommand('volar.action.tagNameCase.convertToKebabCase');
		}
		if (select === '8') {
			vscode.commands.executeCommand('volar.action.tagNameCase.convertToPascalCase');
		}
	}));
	context.subscriptions.push(vscode.commands.registerCommand('volar.action.tagNameCase.convertToKebabCase', async () => {
		if (vscode.window.activeTextEditor) {
			await vscode.commands.executeCommand('volar.server.executeConvertToKebabCase', vscode.window.activeTextEditor.document.uri.toString());
			tagCases.set(vscode.window.activeTextEditor.document.uri.toString(), 'kebabCase');
			updateStatusBarText('kebabCase');
		}
	}));
	context.subscriptions.push(vscode.commands.registerCommand('volar.action.tagNameCase.convertToPascalCase', async () => {
		if (vscode.window.activeTextEditor) {
			await vscode.commands.executeCommand('volar.server.executeConvertToPascalCase', vscode.window.activeTextEditor.document.uri.toString());
			tagCases.set(vscode.window.activeTextEditor.document.uri.toString(), 'pascalCase');
			updateStatusBarText('pascalCase');
		}
	}));

	async function onChangeDocument(newDoc: vscode.TextDocument | undefined) {
		if (newDoc?.languageId === 'vue') {
			let tagCase = tagCases.get(newDoc.uri.toString());
			if (!tagCase) {
				const tagMode = vscode.workspace.getConfiguration('volar').get<'auto' | 'both' | 'kebab' | 'pascal'>('preferredTagNameCase');
				if (tagMode === 'both') {
					tagCase = 'both';
				}
				else if (tagMode === 'kebab') {
					tagCase = 'kebabCase';
				}
				else if (tagMode === 'pascal') {
					tagCase = 'pascalCase';
				}
				else {
					const templateCases = await languageClient.sendRequest(shared.GetServerNameCasesRequest.type, languageClient.code2ProtocolConverter.asTextDocumentIdentifier(newDoc));
					tagCase = templateCases?.tag;
				}
			}
			if (tagCase) {
				tagCases.set(newDoc.uri.toString(), tagCase);
			}
			updateStatusBarText(tagCase);
			statusBar.show();
		}
		else {
			statusBar.hide();
		}
	}
	function updateStatusBarText(tagCase: 'both' | 'kebabCase' | 'pascalCase' | 'unsure' | undefined) {
		let text = `Tag: `;
		if (tagCase === 'unsure' || tagCase === undefined) {
			text += `UNSURE`;
		}
		else if (tagCase === 'both') {
			text += `BOTH`;
		}
		else if (tagCase === 'kebabCase') {
			text += `kebab-case`;
		}
		else if (tagCase === 'pascalCase') {
			text += `PascalCase`;
		}
		statusBar.text = text;
	}
}
