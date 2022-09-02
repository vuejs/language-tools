import { getCurrentTsPaths } from './tsVersion';
import * as vscode from 'vscode';
import * as shared from '@volar/shared';
import { takeOverModeEnabled } from '../common';
import * as fs from '../utils/fs';
import * as semver from 'semver'

export async function register(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand('volar.action.doctor', async () => {

		// TODO: tsconfig infos
		// TODO: warnings
		const vetur = vscode.extensions.getExtension('octref.vetur');
		if (vetur && vetur.isActive) {
			vscode.window.showWarningMessage(
				'Vetur is active. Disable it for Volar to work properly.'
			);
		}

		const tsConfigPaths = [
			...await vscode.workspace.findFiles('tsconfig.json'),
			...await vscode.workspace.findFiles('jsconfig.json'),
		];
		const tsConfigs = await Promise.all(tsConfigPaths.map(async tsConfigPath => ({
			path: tsConfigPath,
			content: await fs.readFile(tsConfigPath),
		})));

		const vueVersion = getWorkspacePackageJson('vue')?.version;
		const runtimeDomVersion = getWorkspacePackageJson('@vue/runtime-dom')?.version;

		let parsedTsConfig: undefined | Record<string, any>
		try {
			parsedTsConfig = tsConfigs[0] ? JSON.parse(tsConfigs[0].content) : undefined
		} catch (error) {
			console.error(error)
			parsedTsConfig = undefined
		}
		const vueTarget = parsedTsConfig?.vueCompilerOptions?.target

		if (vueVersion) {
			if (semver.lte(vueVersion, '2.6.14')) {
				if (!runtimeDomVersion) {
					vscode.window.showWarningMessage(
						'Found Vue with version <2.7 but no "@vue/runtime-dom". Consider adding "@vue/runtime-dom" to your dev dependencies.'
					);
				}
				if (vueTarget !== 2) {
					vscode.window.showWarningMessage(
						'Found Vue with version <2.7 but incorrect "target" option in your "tsconfig.json". Consider adding "target": 2.'
					);
				}
			}
			
			if (semver.gt(vueVersion, '2.6.14') && semver.lt(vueVersion, '3.0.0') && vueTarget !== 2.7) {
				vscode.window.showWarningMessage(
					'Found Vue with version <2.7 but incorrect "target" option in your "tsconfig.json". Consider adding "target": 2.7'
				);
			}
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
- workspace.vue.version: ${vueVersion}
- workspace.@vue/runtime-dom.version: ${runtimeDomVersion}
- workspace.tsconfig.vueCompilerOptions.target: ${vueTarget}
- takeover-mode.enabled: ${takeOverModeEnabled()}

## tsconfigs

${tsConfigs.map(tsconfig => `
\`${tsconfig.path}\`

\`\`\`jsonc
${tsconfig.content}
\`\`\`

`)}

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
