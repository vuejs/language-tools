import { commands, TextDocument, LanguageConfiguration, languages } from 'vscode';
import * as vscode from 'vscode';
import { Range } from 'vscode-languageclient';

const command = 'volar.action.comment';
const languagesConfigs = new Map<string, LanguageConfiguration>();
languagesConfigs.set('vue', require('../../../languages/vue-language-configuration.json'));
languagesConfigs.set('html', require('../../../languages/html-language-configuration.json'));
languagesConfigs.set('pug', require('../../../languages/pug-language-configuration.json'));
languagesConfigs.set('css', require('../../../languages/css-language-configuration.json'));
languagesConfigs.set('scss', require('../../../languages/scss-language-configuration.json'));
languagesConfigs.set('typescript', require('../../../languages/javascript-language-configuration.json'));
languagesConfigs.set('jsx', require('../../../languages/javascript-language-configuration.json'));
languagesConfigs.set('javascript', require('../../../languages/typescript-language-configuration.json'));
languagesConfigs.set('tsx', require('../../../languages/typescript-language-configuration.json'));

export function activateCommenting(embeddedLanguageRequestor: (document: TextDocument, range: vscode.Range) => Thenable<{
	id: string,
	range: Range,
} | undefined>) {

	return commands.registerCommand(command, commandHandler);

	async function commandHandler() {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}

		const selection = editor.selection;
		const activeDocument = editor.document;
		if (activeDocument.languageId !== 'vue') {
			return;
		}

		// TODO: get in client
		const embeddedLanguage = await embeddedLanguageRequestor(activeDocument, new vscode.Selection(
			selection.start.line,
			0,
			selection.end.line,
			activeDocument.lineAt(selection.end.line).text.length,
		));
		if (!embeddedLanguage) {
			return;
		}

		const embeddedLanguageConfig = languagesConfigs.get(embeddedLanguage.id);
		if (!embeddedLanguageConfig) {
			return;
		}

		languages.setLanguageConfiguration('vue', embeddedLanguageConfig);
		await commands.executeCommand('editor.action.commentLine');
		languages.setLanguageConfiguration('vue', languagesConfigs.get('vue')!);
	};
}
