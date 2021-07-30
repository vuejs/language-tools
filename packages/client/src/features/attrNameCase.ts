import * as vscode from 'vscode';
import { userPick } from './splitEditors';
import { LanguageClient } from 'vscode-languageclient/node';
import * as shared from '@volar/shared';

export async function activate(context: vscode.ExtensionContext, languageClient: LanguageClient) {

	await languageClient.onReady();

	while (await languageClient.sendRequest(shared.PingRequest.type) !== 'pong') {
		await shared.sleep(100);
	}

	const attrCases = new shared.UriMap<'kebabCase' | 'pascalCase'>();
	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
	statusBar.command = 'volar.action.attrNameCase';

	onChangeDocument(vscode.window.activeTextEditor?.document);
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(e => {
		onChangeDocument(e?.document);
	}));
	context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((doc) => {
		attrCases.delete(doc.uri.toString());
	}));
	context.subscriptions.push(vscode.commands.registerCommand('volar.action.attrNameCase', async () => {

		const crtDoc = vscode.window.activeTextEditor?.document;
		if (!crtDoc) return;

		const attrCase = attrCases.get(crtDoc.uri.toString());
		const options: Record<string, vscode.QuickPickItem> = {};

		options[4] = { label: (attrCase === 'kebabCase' ? '• ' : '') + 'Prop Using kebab-case' };
		options[5] = { label: (attrCase === 'pascalCase' ? '• ' : '') + 'Prop Using pascalCase' };
		options[6] = { label: 'Detect Prop name from Content' };

		const select = await userPick(options);
		if (select === undefined)
			return; // cancle

		if (select === '4') {
			attrCases.set(crtDoc.uri.toString(), 'kebabCase');
			updateStatusBarText('kebabCase');
		}
		if (select === '5') {
			attrCases.set(crtDoc.uri.toString(), 'pascalCase');
			updateStatusBarText('pascalCase');
		}
		if (select === '6') {
			const detects = await languageClient.sendRequest(shared.DetectDocumentNameCasesRequest.type, languageClient.code2ProtocolConverter.asTextDocumentIdentifier(crtDoc));
			if (detects) {
				attrCases.set(crtDoc.uri.toString(), getValidAttrCase(detects.attr));
				updateStatusBarText(getValidAttrCase(detects.attr));
			}
		}
	}));

	return (uri: string) => {
		let attrCase = attrCases.get(uri);
		if (uri.toLowerCase() === vscode.window.activeTextEditor?.document.uri.toString().toLowerCase()) {
			updateStatusBarText(attrCase);
		}
		return attrCase ?? 'kebabCase';
	};

	async function onChangeDocument(newDoc: vscode.TextDocument | undefined) {
		if (newDoc?.languageId === 'vue') {
			let attrCase = attrCases.get(newDoc.uri.toString());
			if (!attrCase) {
				const attrMode = vscode.workspace.getConfiguration('volar').get<'auto-kebab' | 'auto-pascal' | 'kebab' | 'pascal'>('preferredAttrNameCase');
				if (attrMode === 'kebab') {
					attrCase = 'kebabCase';
				}
				else if (attrMode === 'pascal') {
					attrCase = 'pascalCase';
				}
				else {
					const templateCases = await languageClient.sendRequest(shared.DetectDocumentNameCasesRequest.type, languageClient.code2ProtocolConverter.asTextDocumentIdentifier(newDoc));
					if (templateCases) {
						attrCase = getValidAttrCase(templateCases.attr);
						if (templateCases.attr === 'both') {
							if (attrMode === 'auto-kebab') {
								attrCase = 'kebabCase';
							}
							else if (attrMode === 'auto-pascal') {
								attrCase = 'pascalCase';
							}
						}
					}
				}
			}
			if (attrCase) {
				attrCases.set(newDoc.uri.toString(), attrCase ?? 'unsure');
			}
			updateStatusBarText(attrCase);
			statusBar.show();
		}
		else {
			statusBar.hide();
		}
	}
	function getValidAttrCase(attrCase: 'both' | 'kebabCase' | 'pascalCase' | 'unsure' | undefined): 'kebabCase' | 'pascalCase' {
		if (attrCase === 'both' || attrCase === 'unsure') {
			const attrMode = vscode.workspace.getConfiguration('volar').get<'auto-kebab' | 'auto-pascal' | 'kebab' | 'pascal'>('preferredAttrNameCase');
			if (attrMode === 'auto-kebab') {
				return 'kebabCase';
			}
			else if (attrMode === 'auto-pascal') {
				return 'pascalCase';
			}
			return 'kebabCase';
		}
		return attrCase ?? 'kebabCase';
	}
	function updateStatusBarText(
		attrCase: 'kebabCase' | 'pascalCase' | undefined,
	) {
		let text = `Attr: `;
		if (attrCase === 'kebabCase' || attrCase === undefined) {
			text += `kebab-case`;
		}
		else if (attrCase === 'pascalCase') {
			text += `pascalCase`;
		}
		statusBar.text = text;
	}
}
