import * as vscode from 'vscode';
import { userPick } from './splitEditors';
import { BaseLanguageClient, State } from 'vscode-languageclient';
import * as shared from '@volar/shared';
import { DetectDocumentNameCasesRequest } from '@volar/vue-language-server';

export async function activate(context: vscode.ExtensionContext, languageClient: BaseLanguageClient) {

	const tagCases = shared.createUriMap<'both' | 'kebabCase' | 'pascalCase' | 'unsure'>();
	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
	statusBar.command = 'volar.action.tagNameCase';

	onChangeDocument(vscode.window.activeTextEditor?.document);

	const d_1 = vscode.window.onDidChangeActiveTextEditor(e => {
		onChangeDocument(e?.document);
	});
	const d_2 = vscode.workspace.onDidCloseTextDocument((doc) => {
		tagCases.uriDelete(doc.uri.toString());
	});
	const d_3 = vscode.commands.registerCommand('volar.action.tagNameCase', async () => {

		const crtDoc = vscode.window.activeTextEditor?.document;
		if (!crtDoc) return;

		const tagCase = tagCases.uriGet(crtDoc.uri.toString());
		const options: Record<string, vscode.QuickPickItem> = {};

		options[0] = { label: (tagCase === 'both' ? '• ' : '') + 'Component Using kebab-case and PascalCase (Both)' };
		options[1] = { label: (tagCase === 'kebabCase' ? '• ' : '') + 'Component Using kebab-case' };
		options[2] = { label: (tagCase === 'pascalCase' ? '• ' : '') + 'Component Using PascalCase' };
		options[3] = { label: 'Detect Component name from Content' };
		options[7] = { label: 'Convert Component name to kebab-case' };
		options[8] = { label: 'Convert Component name to PascalCase' };

		const select = await userPick(options);
		if (select === undefined)
			return; // cancel

		if (select === '0') {
			tagCases.uriSet(crtDoc.uri.toString(), 'both');
			updateStatusBarText('both');
		}
		if (select === '1') {
			tagCases.uriSet(crtDoc.uri.toString(), 'kebabCase');
			updateStatusBarText('kebabCase');
		}
		if (select === '2') {
			tagCases.uriSet(crtDoc.uri.toString(), 'pascalCase');
			updateStatusBarText('pascalCase');
		}
		if (select === '3') {
			const detects = await languageClient.sendRequest(DetectDocumentNameCasesRequest.type, languageClient.code2ProtocolConverter.asTextDocumentIdentifier(crtDoc));
			if (detects) {
				tagCases.uriSet(crtDoc.uri.toString(), detects.tag);
				updateStatusBarText(detects.tag);
			}
		}
		if (select === '7') {
			vscode.commands.executeCommand('volar.action.tagNameCase.convertToKebabCase');
		}
		if (select === '8') {
			vscode.commands.executeCommand('volar.action.tagNameCase.convertToPascalCase');
		}
	});
	const d_4 = vscode.commands.registerCommand('volar.action.tagNameCase.convertToKebabCase', async () => {
		if (vscode.window.activeTextEditor) {
			await vscode.commands.executeCommand('volar.server.convertTagNameCasing', vscode.window.activeTextEditor.document.uri.toString(), 'kebab');
			tagCases.uriSet(vscode.window.activeTextEditor.document.uri.toString(), 'kebabCase');
			updateStatusBarText('kebabCase');
		}
	});
	const d_5 = vscode.commands.registerCommand('volar.action.tagNameCase.convertToPascalCase', async () => {
		if (vscode.window.activeTextEditor) {
			await vscode.commands.executeCommand('volar.server.convertTagNameCasing', vscode.window.activeTextEditor.document.uri.toString(), 'pascal');
			tagCases.uriSet(vscode.window.activeTextEditor.document.uri.toString(), 'pascalCase');
			updateStatusBarText('pascalCase');
		}
	});

	languageClient.onDidChangeState(e => {
		if (e.newState === State.Stopped) {
			d_1.dispose();
			d_2.dispose();
			d_3.dispose();
			d_4.dispose();
			d_5.dispose();
			statusBar.dispose();
		}
	});

	return (uri: string) => {
		let tagCase = tagCases.uriGet(uri);
		if (uri.toLowerCase() === vscode.window.activeTextEditor?.document.uri.toString().toLowerCase()) {
			updateStatusBarText(tagCase);
		}
		return !tagCase || tagCase === 'unsure' ? 'both' : tagCase;
	};

	async function onChangeDocument(newDoc: vscode.TextDocument | undefined) {
		if (
			newDoc?.languageId === 'vue'
			|| newDoc?.languageId === 'markdown'
			|| newDoc?.languageId === 'html'
		) {
			let tagCase = tagCases.uriGet(newDoc.uri.toString());
			if (!tagCase) {
				const tagMode = vscode.workspace.getConfiguration('volar').get<'auto' | 'both' | 'kebab' | 'pascal'>('completion.preferredTagNameCase');
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
					const templateCases = await languageClient.sendRequest(DetectDocumentNameCasesRequest.type, languageClient.code2ProtocolConverter.asTextDocumentIdentifier(newDoc));
					tagCase = templateCases?.tag;
				}
			}
			if (tagCase) {
				tagCases.uriSet(newDoc.uri.toString(), tagCase);
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
