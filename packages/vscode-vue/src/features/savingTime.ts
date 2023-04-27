import * as vscode from 'vscode';
import { config } from '../config';

export function register() {

	let start: number | undefined;
	let isSavingMultiple = false;

	return [
		vscode.workspace.onWillSaveTextDocument((e) => {
			if (e.document.languageId !== 'vue') {
				return;
			}
			if (start !== undefined) {
				isSavingMultiple = true;
			}
			start = Date.now();
		}),
		vscode.workspace.onDidSaveTextDocument(async () => {

			if (isSavingMultiple) {
				isSavingMultiple = false;
				start = undefined;
			}

			if (start === undefined) {
				return;
			}

			const time = Date.now() - start;
			start = undefined;

			if (config.codeActions.enabled && time > config.codeActions.savingTimeLimit) {
				const options = [
					'Disable codeActions',
					'Increase saveTimeLimit',
					'What is this?',
				];;
				const result = await vscode.window.showInformationMessage(
					`Saving time is too long. (${time} ms > ${config.codeActions.savingTimeLimit} ms), `,
					...options,
				);
				if (result === options[0]) {
					config.update('codeActions.enabled', false);
					vscode.window.showInformationMessage('Code Actions is disabled. (You can enable it in .vscode/settings.json)');
				}
				else if (result === options[1]) {
					vscode.commands.executeCommand('workbench.action.openSettings2', { query: 'vue.codeActions.savingTimeLimit' });
				}
				else if (result === options[2]) {
					vscode.env.openExternal(vscode.Uri.parse('https://github.com/vuejs/language-tools/discussions/2740'));
				}
			}
		}),
	];
}
