import { BaseLanguageClient, ExecuteCommandParams, ExecuteCommandRequest, getTsdk } from '@volar/vscode';
import type { SFCParseResult } from '@vue/language-server';
import { commands } from '@vue/language-server/lib/types';
import * as semver from 'semver';
import * as vscode from 'vscode';
import { config } from '../config';

const scheme = 'vue-doctor';
const knownValidSyntaxHighlightExtensions = {
	postcss: ['cpylua.language-postcss', 'vunguyentuan.vscode-postcss', 'csstools.postcss'],
	stylus: ['sysoev.language-stylus'],
	sass: ['Syler.sass-indented'],
};

export async function register(context: vscode.ExtensionContext, client: BaseLanguageClient) {

	const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
	item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
	item.command = 'vue.action.doctor';

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
				content += `> Have any questions about the report message? You can see how it is composed by inspecting the [source code](https://github.com/vuejs/language-tools/blob/master/extensions/vscode/src/features/doctor.ts).\n\n`;

				return content.trim();
			}
		}
	));
	context.subscriptions.push(vscode.commands.registerCommand('vue.action.doctor', () => {
		const doc = vscode.window.activeTextEditor?.document;
		if (
			doc
			&& (doc.languageId === 'vue' || doc.uri.toString().endsWith('.vue'))
			&& doc.uri.scheme === 'file'
		) {
			vscode.commands.executeCommand('markdown.showPreviewToSide', getDoctorUri(doc.uri));
		}
	}));

	function getDoctorUri(fileUri: vscode.Uri) {
		return fileUri.with({ scheme, path: fileUri.path + '/Doctor.md' });
	}

	async function updateStatusBar(editor: vscode.TextEditor | undefined) {
		if (
			config.doctor.status
			&& editor
			&& (editor.document.languageId === 'vue' || editor.document.uri.toString().endsWith('.vue'))
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
		const sfc: SFCParseResult = vueDoc
			? await client.sendRequest(ExecuteCommandRequest.type, {
				command: commands.parseSfc,
				arguments: [vueDoc.getText()],
			} satisfies ExecuteCommandParams)
			: undefined;
		const vueMod = getPackageJsonOfWorkspacePackage(fileUri.fsPath, 'vue');
		const domMod = getPackageJsonOfWorkspacePackage(fileUri.fsPath, '@vue/runtime-dom');
		const problems: {
			title: string;
			message: string;
		}[] = [];

		if (vueMod && semver.lt(vueMod.json.version, '2.7.0') && !domMod) {
			// check vue version < 2.7 but @vue/runtime-dom missing
			problems.push({
				title: '`@vue/runtime-dom` missing for Vue 2',
				message: [
					'Vue 2 does not have JSX types definitions, so template type checking will not work correctly. You can resolve this problem by installing `@vue/runtime-dom` and adding it to your project\'s `devDependencies`.',
					'',
					'- vue: ' + vueMod.path,
				].join('\n'),
			});
		}
		else if (vueMod && semver.gte(vueMod.json.version, '2.7.0') && semver.lt(vueMod.json.version, '3.0.0') && domMod) {
			// check vue version >= 2.7 and < 3 but installed @vue/runtime-dom
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
					'- Issue: https://github.com/vuejs/language-tools/issues/1985',
				].join('\n'),
			});
		}

		const pugPluginPkg = await getPackageJsonOfWorkspacePackage(fileUri.fsPath, '@vue/language-plugin-pug');

		// check using pug but don't install @vue/language-plugin-pug
		if (
			sfc?.descriptor.template?.lang === 'pug'
			&& !pugPluginPkg
		) {
			problems.push({
				title: '`@vue/language-plugin-pug` missing',
				message: [
					'For `<template lang="pug">`, the `@vue/language-plugin-pug` plugin is required. Install it using `$ npm install -D @vue/language-plugin-pug` and add it to `vueCompilerOptions.plugins` to support TypeScript intellisense in Pug templates.',
					'',
					'- package.json',
					'```json',
					JSON.stringify({ devDependencies: { "@vue/language-plugin-pug": "latest" } }, undefined, 2),
					'```',
					'',
					'- tsconfig.json / jsconfig.json',
					'```jsonc',
					JSON.stringify({ vueCompilerOptions: { plugins: ["@vue/language-plugin-pug"] } }, undefined, 2),
					'```',
				].join('\n'),
			});
		}

		// check using pug but outdated @vue/language-plugin-pug
		if (
			sfc?.descriptor.template?.lang === 'pug'
			&& pugPluginPkg
			&& !semver.gte(pugPluginPkg.json.version, '2.0.5')
		) {
			problems.push({
				title: 'Outdated `@vue/language-plugin-pug`',
				message: [
					'The version of `@vue/language-plugin-pug` is too low, it is required to upgrade to `2.0.5` or later.',
					'',
					'- @vue/language-plugin-pug: ' + pugPluginPkg.path,
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
				if (!block) {
					continue;
				}
				if (block.lang && block.lang in knownValidSyntaxHighlightExtensions) {
					const validExts = knownValidSyntaxHighlightExtensions[block.lang as keyof typeof knownValidSyntaxHighlightExtensions];
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

		// emmet.includeLanguages
		const emmetIncludeLanguages = vscode.workspace.getConfiguration('emmet').get<{ [lang: string]: string; }>('includeLanguages');
		if (emmetIncludeLanguages?.['vue']) {
			problems.push({
				title: 'Unnecessary `emmet.includeLanguages.vue`',
				message: 'Vue language server already supports Emmet. You can remove `emmet.includeLanguages.vue` from `.vscode/settings.json`.',
			});
		}

		// files.associations
		const filesAssociations = vscode.workspace.getConfiguration('files').get<{ [pattern: string]: string; }>('associations');
		if (filesAssociations?.['*.vue'] === 'html') {
			problems.push({
				title: 'Unnecessary `files.associations["*.vue"]`',
				message: 'With `"files.associations": { "*.vue": html }`, language server cannot to recognize Vue files. You can remove `files.associations["*.vue"]` from `.vscode/settings.json`.',
			});
		}

		// check tsdk version should be higher than 5.0.0
		const tsdk = (await getTsdk(context))!;
		if (tsdk.version && !semver.gte(tsdk.version, '5.0.0')) {
			problems.push({
				title: 'Requires TSDK 5.0 or higher',
				message: [
					`Extension >= 2.0 requires TSDK 5.0+. You are currently using TSDK ${tsdk.version}, please upgrade to TSDK.`,
					'If you need to use TSDK 4.x, please downgrade the extension to v1.',
				].join('\n'),
			});
		}

		if (
			vscode.workspace.getConfiguration('vue').has('server.additionalExtensions')
			|| vscode.workspace.getConfiguration('vue').has('server.petiteVue.supportHtmlFile')
			|| vscode.workspace.getConfiguration('vue').has('server.vitePress.supportMdFile')
		) {
			problems.push({
				title: 'Deprecated configuration',
				message: [
					'`vue.server.additionalExtensions`, `vue.server.petiteVue.supportHtmlFile`, and `vue.server.vitePress.supportMdFile` are deprecated. Please remove them from your settings.',
					'',
					'- PR: https://github.com/vuejs/language-tools/pull/4321',
				].join('\n'),
			});
		}

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
