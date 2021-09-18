import * as vscode from 'vscode';

export async function activate(context: vscode.ExtensionContext) {

	const shouldTsPluginEnabled = getTsPluginConfig();
	if (shouldTsPluginEnabled) {
		const install = 'Install "TypeScript Vue Plugin"';
		const takeOverMode = 'What is Take Over Mode?';
		const select = await vscode.window.showWarningMessage('TS plugin is a independent extension after 0.27.22, please install "TypeScript Vue Plugin" extension, or use take over mode instead of. (Please remove `volar.tsPlugin` setting to disable this prompt)', install, takeOverMode);
		if (select === install) {
			vscode.env.openExternal(vscode.Uri.parse('https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.typescript-vue-plugin'));
		}
		else if (select === takeOverMode) {
			vscode.env.openExternal(vscode.Uri.parse('https://github.com/johnsoncodehk/volar/discussions/471'));
		}
	}
}

function getTsPluginConfig() {
	return vscode.workspace.getConfiguration('volar').get<boolean | null>('tsPlugin');
}
