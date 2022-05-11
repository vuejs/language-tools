import { getCurrentTsPaths } from './tsVersion';
import * as vscode from 'vscode';
import * as shared from '@volar/shared';
import { takeOverModeEnabled } from '../common';

export async function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand('volar.action.doctor', async () => {

		// TODO: tsconfig infos
		// TODO: warnings

		const tsPaths = getCurrentTsPaths(context);
		const tsVersion = shared.getTypeScriptVersion(tsPaths.serverPath);
		const content = `
## Infos

vscode.version: ${vscode.version}
vscode.typescript.version: ${tsVersion}
vscode.typescript-extension.actived: ${!!vscode.extensions.getExtension('vscode.typescript-language-features')}
vue-language-features.version: ${context.extension.packageJSON.version}
typescript-vue-plugin.version: ${vscode.extensions.getExtension('Vue.vscode-typescript-vue-plugin')?.packageJSON.version}
vetur.actived: ${!!vscode.extensions.getExtension('octref.vetur')}
workspace.vue-tsc.version: ${getWorkspacePackageJson('vue-tsc')?.version}
workspace.typescript.version: ${getWorkspacePackageJson('typescript')?.version}
workspace.vue.version: ${getWorkspacePackageJson('vue')?.version}
workspace.@vue/runtime-dom.version: ${getWorkspacePackageJson('@vue/runtime-dom')?.version}
takeover-mode.enabled: ${takeOverModeEnabled()}

### Configuration

\`\`\`json
${JSON.stringify({
			volar: vscode.workspace.getConfiguration('').get('volar'),
			typescript: vscode.workspace.getConfiguration('').get('typescript'),
			javascript: vscode.workspace.getConfiguration('').get('javascript'),
		}, null, 2)}
\`\`\`
`;

		const document = await vscode.workspace.openTextDocument({ content: content.trim(), language: 'markdown' });

		await vscode.window.showTextDocument(document);
	}));
}

function getWorkspacePackageJson(pkg: string): { version: string; } | undefined {
	try {
		return require(require.resolve(pkg + '/package.json', { paths: [vscode.workspace.rootPath!] }));
	} catch { }
}
