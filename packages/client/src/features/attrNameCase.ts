import * as vscode from 'vscode';
import { userPick } from './splitEditors';
import { LanguageClient, State } from 'vscode-languageclient/node';
import * as shared from '@volar/shared';

export async function activate(context: vscode.ExtensionContext, languageClient: LanguageClient) {

	await languageClient.onReady();
	await languageClient.sendRequest(shared.InitDoneRequest.type);

	const attrCases = shared.createPathMap<'kebabCase' | 'camelCase'>();
	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
	statusBar.command = 'volar.action.attrNameCase';

	onChangeDocument(vscode.window.activeTextEditor?.document);
	const d_1 = vscode.window.onDidChangeActiveTextEditor(e => {
		onChangeDocument(e?.document);
	});
	const d_2 = vscode.workspace.onDidCloseTextDocument((doc) => {
		attrCases.uriDelete(doc.uri.toString());
	});
	const d_3 = vscode.commands.registerCommand('volar.action.attrNameCase', async () => {

		const crtDoc = vscode.window.activeTextEditor?.document;
		if (!crtDoc) return;

		const attrCase = attrCases.uriGet(crtDoc.uri.toString());
		const options: Record<string, vscode.QuickPickItem> = {};

		options[4] = { label: (attrCase === 'kebabCase' ? '• ' : '') + 'Prop Using kebab-case' };
		options[5] = { label: (attrCase === 'camelCase' ? '• ' : '') + 'Prop Using camelCase' };
		options[6] = { label: 'Detect Prop name from Content' };

		const select = await userPick(options);
		if (select === undefined)
			return; // cancle

		if (select === '4') {
			attrCases.uriSet(crtDoc.uri.toString(), 'kebabCase');
			updateStatusBarText('kebabCase');
		}
		if (select === '5') {
			attrCases.uriSet(crtDoc.uri.toString(), 'camelCase');
			updateStatusBarText('camelCase');
		}
		if (select === '6') {
			const detects = await languageClient.sendRequest(shared.DetectDocumentNameCasesRequest.type, languageClient.code2ProtocolConverter.asTextDocumentIdentifier(crtDoc));
			if (detects) {
				attrCases.uriSet(crtDoc.uri.toString(), getValidAttrCase(detects.attr));
				updateStatusBarText(getValidAttrCase(detects.attr));
			}
		}
	});

	languageClient.onDidChangeState(e => {
		if (e.newState === State.Stopped) {
			d_1.dispose();
			d_2.dispose();
			d_3.dispose();
			statusBar.dispose();
		}
	});

	return (uri: string) => {
		let attrCase = attrCases.uriGet(uri);
		if (uri.toLowerCase() === vscode.window.activeTextEditor?.document.uri.toString().toLowerCase()) {
			updateStatusBarText(attrCase);
		}
		return attrCase ?? 'kebabCase';
	};

	async function onChangeDocument(newDoc: vscode.TextDocument | undefined) {
		if (newDoc?.languageId === 'vue') {
			let attrCase = attrCases.uriGet(newDoc.uri.toString());
			if (!attrCase) {
				const attrMode = vscode.workspace.getConfiguration('volar').get<'auto-kebab' | 'auto-camel' | 'kebab' | 'camel'>('completion.preferredAttrNameCase');
				if (attrMode === 'kebab') {
					attrCase = 'kebabCase';
				}
				else if (attrMode === 'camel') {
					attrCase = 'camelCase';
				}
				else {
					const templateCases = await languageClient.sendRequest(shared.DetectDocumentNameCasesRequest.type, languageClient.code2ProtocolConverter.asTextDocumentIdentifier(newDoc));
					if (templateCases) {
						attrCase = getValidAttrCase(templateCases.attr);
						if (templateCases.attr === 'both') {
							if (attrMode === 'auto-kebab') {
								attrCase = 'kebabCase';
							}
							else if (attrMode === 'auto-camel') {
								attrCase = 'camelCase';
							}
						}
					}
				}
			}
			if (attrCase) {
				attrCases.uriSet(newDoc.uri.toString(), attrCase ?? 'unsure');
			}
			updateStatusBarText(attrCase);
			statusBar.show();
		}
		else {
			statusBar.hide();
		}
	}
	function getValidAttrCase(attrCase: 'both' | 'kebabCase' | 'camelCase' | 'unsure' | undefined): 'kebabCase' | 'camelCase' {
		if (attrCase === 'both' || attrCase === 'unsure') {
			const attrMode = vscode.workspace.getConfiguration('volar').get<'auto-kebab' | 'auto-camel' | 'kebab' | 'camel'>('completion.preferredAttrNameCase');
			if (attrMode === 'auto-kebab') {
				return 'kebabCase';
			}
			else if (attrMode === 'auto-camel') {
				return 'camelCase';
			}
			return 'kebabCase';
		}
		return attrCase ?? 'kebabCase';
	}
	function updateStatusBarText(
		attrCase: 'kebabCase' | 'camelCase' | undefined,
	) {
		let text = `Attr: `;
		if (attrCase === 'kebabCase' || attrCase === undefined) {
			text += `kebab-case`;
		}
		else if (attrCase === 'camelCase') {
			text += `camelCase`;
		}
		statusBar.text = text;
	}
}
