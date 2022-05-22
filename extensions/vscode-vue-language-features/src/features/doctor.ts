import { getCurrentTsPaths } from './tsVersion';
import * as vscode from 'vscode';
import * as shared from '@volar/shared';
import { takeOverModeEnabled } from '../common';
import * as fs from 'fs'

export async function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand('volar.action.doctor', async () => {

		// TODO: tsconfig infos
		// TODO: warnings
		const vetur = vscode.extensions.getExtension('octref.vetur')
		if (vetur && vetur.isActive) {
			vscode.window.showWarningMessage(
				'Vetur is active. Disable it for Volar to work properly.'
			)
		}

		let experimentalCompatMode = undefined
		const tsConfigPaths = await vscode.workspace.findFiles('tsconfig.json')
		if (tsConfigPaths.length > 0) {
			const data = fs.readFileSync(tsConfigPaths[0].fsPath, 'utf8')
			const tsConfig = JSON.parse(data)
			experimentalCompatMode = tsConfig.vueCompilerOptions?.experimentalCompatMode
		}

		const tsPaths = getCurrentTsPaths(context);
		const tsVersion = shared.getTypeScriptVersion(tsPaths.serverPath);
		const content = `
## Infos

- vscode.version: ${vscode.version}
- vscode.typescript.version: ${tsVersion}
- vscode.typescript-extension.actived: ${!!vscode.extensions.getExtension('vscode.typescript-language-features')}
- vue-language-features.version: ${context.extension.packageJSON.version}
- typescript-vue-plugin.version: ${vscode.extensions.getExtension('Vue.vscode-typescript-vue-plugin')?.packageJSON.version}
- vetur.actived: ${!!vetur}
- workspace.vue-tsc.version: ${getWorkspacePackageJson('vue-tsc')?.version}
- workspace.typescript.version: ${getWorkspacePackageJson('typescript')?.version}
- workspace.vue.version: ${getWorkspacePackageJson('vue')?.version}
- workspace.@vue/runtime-dom.version: ${getWorkspacePackageJson('@vue/runtime-dom')?.version}
- workspace.tsconfig.experimentalCompatMode: ${experimentalCompatMode}
- takeover-mode.enabled: ${takeOverModeEnabled()}

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
