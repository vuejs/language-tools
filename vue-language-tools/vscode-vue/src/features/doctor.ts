import * as vscode from 'vscode';
import * as semver from 'semver';
import { BaseLanguageClient } from 'vscode-languageclient';
import { GetMatchTsConfigRequest, ParseSFCRequest, GetVueCompilerOptionsRequest } from '@volar/vue-language-server';

const scheme = 'vue-doctor';
const knownValidSyntanxHighlightExtensions = {
	postcss: ['cpylua.language-postcss', 'vunguyentuan.vscode-postcss', 'csstools.postcss'],
	stylus: ['sysoev.language-stylus'],
	sass: ['Syler.sass-indented'],
};

export async function register(context: vscode.ExtensionContext, client: BaseLanguageClient) {

	const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
	item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
	item.command = 'volar.action.doctor';

	const docChangeEvent = new vscode.EventEmitter<vscode.Uri>();

	updateStatusBar(vscode.window.activeTextEditor);

	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateStatusBar));
	context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(
		scheme,
		{
			onDidChange: docChangeEvent.event,
			async provideTextDocumentContent(doctorUri: vscode.Uri): Promise<string | undefined> {

				const fileUri = doctorUri.with({
					scheme: 'file',
					path: doctorUri.path.substring(0, doctorUri.path.length - '/Doctor.md'.length),
				});
				const problems = await getProblems(fileUri);

				let content = `# ${fileUri.path.split('/').pop()} Doctor\n\n`;

				for (const problem of problems) {
					content += '## ❗ ' + problem.title + '\n\n';
					content += problem.message + '\n\n';
				}

				content += '---\n\n';
				content += `> Have any questions about the report message? You can see how it is composed by inspecting the [source code](https://github.com/johnsoncodehk/volar/blob/master/extensions/vscode-vue/src/features/doctor.ts).\n\n`;

				return content.trim();
			}
		},
	));
	context.subscriptions.push(vscode.commands.registerCommand('volar.action.doctor', () => {
		const doc = vscode.window.activeTextEditor?.document;
		if (doc?.languageId === 'vue' && doc.uri.scheme === 'file') {
			vscode.commands.executeCommand('markdown.showPreviewToSide', getDoctorUri(doc.uri));
		}
	}));

	function getDoctorUri(fileUri: vscode.Uri) {
		return fileUri.with({ scheme, path: fileUri.path + '/Doctor.md' });
	}

	async function updateStatusBar(editor: vscode.TextEditor | undefined) {
		if (
			vscode.workspace.getConfiguration('volar').get<boolean>('doctor.statusBarItem')
			&& editor
			&& editor.document.languageId === 'vue'
			&& editor.document.uri.scheme === 'file'
		) {
			const problems = await getProblems(editor.document.uri);
			if (problems.length && vscode.window.activeTextEditor?.document === editor.document) {
				item.show();
				item.text = problems.length + (problems.length === 1 ? ' known issue' : ' known issues');
				docChangeEvent.fire(getDoctorUri(editor.document.uri));
			}
		}
		else {
			item.hide();
		}
	}

	async function getProblems(fileUri: vscode.Uri) {

		const vueDoc = vscode.workspace.textDocuments.find(doc => doc.fileName === fileUri.fsPath);
		const [
			tsconfig,
			vueOptions,
			sfc,
		] = await Promise.all([
			client.sendRequest(GetMatchTsConfigRequest.type, { uri: fileUri.toString() }),
			client.sendRequest(GetVueCompilerOptionsRequest.type, { uri: fileUri.toString() }),
			vueDoc ? client.sendRequest(ParseSFCRequest.type, vueDoc.getText()) : undefined,
		]);
		const vueMod = getPackageJsonOfWorkspacePackage(fileUri.fsPath, 'vue');
		const domMod = getPackageJsonOfWorkspacePackage(fileUri.fsPath, '@vue/runtime-dom');
		const problems: {
			title: string;
			message: string;
		}[] = [];

		// check vue module exist
		if (!vueMod) {
			problems.push({
				title: '`vue` module not found',
				message: 'Vue module not found from workspace, you may not have installed `node_modules` yet.',
			});
		}

		// check vue version < 3 but missing vueCompilerOptions.target
		if (vueMod) {
			const vueVersionNumber = semver.gte(vueMod.json.version, '3.0.0') ? 3 : semver.gte(vueMod.json.version, '2.7.0') ? 2.7 : 2;
			const targetVersionNumber = vueOptions?.target ?? 3;
			const lines = [
				`Target version mismatch. You can specify the target version in \`vueCompilerOptions.target\` in tsconfig.json / jsconfig.json. (Expected \`"target": ${vueVersionNumber}\`)`,
				'',
				'- vue version: ' + vueMod.json.version,
				'- tsconfig target: ' + targetVersionNumber + (vueOptions?.target !== undefined ? '' : ' (default)'),
				'- vue: ' + vueMod.path,
				'- tsconfig: ' + (tsconfig?.uri ?? 'Not found'),
				'- vueCompilerOptions:',
				'  ```json',
				JSON.stringify(vueOptions, undefined, 2).split('\n').map(line => '  ' + line).join('\n'),
				'  ```',
			];
			if (vueVersionNumber !== targetVersionNumber) {
				problems.push({
					title: 'Incorrect Target',
					message: lines.join('\n'),
				});
			}
		}

		// check vue version < 2.7 but @vue/runtime-dom missing
		if (vueMod && semver.lt(vueMod.json.version, '2.7.0') && !domMod) {
			problems.push({
				title: '`@vue/runtime-dom` missing for Vue 2',
				message: [
					'Vue 2 does not have JSX types definitions, so template type checking will not work correctly. You can resolve this problem by installing `@vue/runtime-dom` and adding it to your project\'s `devDependencies`.',
					'',
					'- vue: ' + vueMod.path,
				].join('\n'),
			});
		}

		// check vue version >= 2.7 and < 3 but installed @vue/runtime-dom
		if (vueMod && semver.gte(vueMod.json.version, '2.7.0') && semver.lt(vueMod.json.version, '3.0.0') && domMod) {
			problems.push({
				title: 'Unnecessary `@vue/runtime-dom`',
				message: [
					'Vue 2.7 already includes JSX type definitions. You can remove the `@vue/runtime-dom` dependency from package.json.',
					'',
					'- vue: ' + vueMod.path,
					'- @vue/runtime-dom: ' + domMod.path,
				].join('\n'),
			});
		}

		// check vue-tsc version same with extension version
		if (vscode.workspace.getConfiguration('volar').get<boolean>('doctor.checkVueTsc')) {
			const vueTscMod = getPackageJsonOfWorkspacePackage(fileUri.fsPath, 'vue-tsc');
			if (vueTscMod && vueTscMod.json.version !== context.extension.packageJSON.version) {
				problems.push({
					title: 'Different `vue-tsc` version',
					message: [
						`The \`${context.extension.packageJSON.displayName}\`\'s version is \`${context.extension.packageJSON.version}\`, but the workspace\'s \`vue-tsc\` version is \`${vueTscMod.json.version}\`. This may produce different type checking behavior.`,
						'',
						'- vue-tsc: ' + vueTscMod.path,
					].join('\n'),
				});
			}
		}

		// check @types/node > 18.8.0 && < 18.11.1
		const typesNodeMod = getPackageJsonOfWorkspacePackage(fileUri.fsPath, '@types/node');
		if (typesNodeMod && semver.gte(typesNodeMod.json.version, '18.8.1') && semver.lte(typesNodeMod.json.version, '18.11.0')) {
			problems.push({
				title: 'Incompatible `@types/node` version',
				message: [
					'`@types/node`\'s version `' + typesNodeMod.json.version + '` is incompatible with Vue. It will cause broken DOM event types in template.',
					'',
					'You can update `@types/node` to `18.11.1` or later to resolve.',
					'',
					'- @types/node: ' + typesNodeMod.path,
					'- Issue: https://github.com/johnsoncodehk/volar/issues/1985',
				].join('\n'),
			});
		}

		// check should use @volar-plugins/vetur instead of vetur
		const vetur = vscode.extensions.getExtension('octref.vetur');
		if (vetur?.isActive) {
			problems.push({
				title: 'Use @volar-plugins/vetur instead of Vetur',
				message: 'Detected Vetur enabled. Consider disabling Vetur and use [@volar-plugins/vetur](https://github.com/johnsoncodehk/volar-plugins/tree/master/packages/vetur) instead.',
			});
		}

		// check using pug but don't install @volar/vue-language-plugin-pug
		if (
			sfc?.descriptor.template?.lang === 'pug'
			&& !vueOptions?.plugins?.some((pluginPath: string) => pluginPath.indexOf('vue-language-plugin-pug') >= 0)
		) {
			problems.push({
				title: '`@volar/vue-language-plugin-pug` missing',
				message: [
					'For `<template lang="pug">`, the `@volar/vue-language-plugin-pug` plugin is required. Install it using `$ npm install -D @volar/vue-language-plugin-pug` and add it to `vueCompilerOptions.plugins` to support TypeScript intellisense in Pug templates.',
					'',
					'- package.json',
					'```json',
					JSON.stringify({ devDependencies: { "@volar/vue-language-plugin-pug": "latest" } }, undefined, 2),
					'```',
					'',
					'- tsconfig.json / jsconfig.json',
					'```jsonc',
					JSON.stringify({ vueCompilerOptions: { plugins: ["@volar/vue-language-plugin-pug"] } }, undefined, 2),
					'```',
				].join('\n'),
			});
		}

		// check syntax highlight extension installed
		if (sfc) {
			const blocks = [
				sfc.descriptor.template,
				sfc.descriptor.script,
				sfc.descriptor.scriptSetup,
				...sfc.descriptor.styles,
				...sfc.descriptor.customBlocks,
			];
			for (const block of blocks) {
				if (!block) continue;
				if (block.lang && block.lang in knownValidSyntanxHighlightExtensions) {
					const validExts = knownValidSyntanxHighlightExtensions[block.lang as keyof typeof knownValidSyntanxHighlightExtensions];
					const someInstalled = validExts.some(ext => !!vscode.extensions.getExtension(ext));
					if (!someInstalled) {
						problems.push({
							title: 'Syntax Highlighting for ' + block.lang,
							message: `Did not find a valid syntax highlighter extension for ${block.lang} language block; you can choose to install one of the following:\n\n`
								+ validExts.map(ext => `- [${ext}](https://marketplace.visualstudio.com/items?itemName=${ext})\n`),
						});
					}
				}
			}
		}

		// check outdated language services plugins
		// check outdated vue language plugins
		// check node_modules has more than one vue versions
		// check ESLint, Prettier...

		return problems;
	}
}

function getPackageJsonOfWorkspacePackage(folder: string, pkg: string): { path: string, json: { version: string; }; } | undefined {
	try {
		const path = require.resolve(pkg + '/package.json', { paths: [folder] });
		return {
			path,
			json: require(path),
		};
	} catch { }
}
