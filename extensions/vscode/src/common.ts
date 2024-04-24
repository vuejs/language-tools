import { DiagnosticModel, VueInitializationOptions } from '@vue/language-server';
import * as vscode from 'vscode';
import * as lsp from '@volar/vscode';
import { config } from './config';
import * as doctor from './features/doctor';
import * as nameCasing from './features/nameCasing';
import * as splitEditors from './features/splitEditors';
import * as semver from 'semver';
import * as fs from 'fs';
import * as path from 'path';
import { quickPick } from '@volar/vscode/lib/common';

let client: lsp.BaseLanguageClient;

type CreateLanguageClient = (
	id: string,
	name: string,
	langs: lsp.DocumentFilter[],
	initOptions: VueInitializationOptions,
	port: number,
	outputChannel: vscode.OutputChannel,
) => lsp.BaseLanguageClient;

export async function activate(context: vscode.ExtensionContext, createLc: CreateLanguageClient) {

	const stopCheck = vscode.window.onDidChangeActiveTextEditor(tryActivate);
	tryActivate();

	function tryActivate() {
		if (
			vscode.window.visibleTextEditors.some(editor => editor.document.languageId === 'vue')
			|| (config.server.vitePress.supportMdFile && vscode.window.visibleTextEditors.some(editor => editor.document.languageId === 'vue'))
			|| (config.server.petiteVue.supportHtmlFile && vscode.window.visibleTextEditors.some(editor => editor.document.languageId === 'html'))
		) {
			doActivate(context, createLc);
			stopCheck.dispose();
		}
	}
}

export const enabledHybridMode = getCurrentHybridModeStatus();

export const enabledTypeScriptPlugin = getCurrentTypeScriptPluginStatus(enabledHybridMode);

vscode.commands.executeCommand('setContext', 'vueHybridMode', enabledHybridMode);

function getCurrentTypeScriptPluginStatus(enabledHybridMode: boolean) {
	return enabledHybridMode || config.server.hybridMode === 'typeScriptPluginOnly';
}

function getCurrentHybridModeStatus(report = false) {
	if (config.server.hybridMode === 'typeScriptPluginOnly') {
		return false;
	}
	else if (config.server.hybridMode === 'auto') {
		const unknownExtensions: string[] = [];
		for (const extension of vscode.extensions.all) {
			const hasTsPlugin = !!extension.packageJSON?.contributes?.typescriptServerPlugins;
			if (hasTsPlugin) {
				if (
					extension.id === 'Vue.volar'
					|| extension.id === 'unifiedjs.vscode-mdx'
					|| extension.id === 'astro-build.astro-vscode'
					|| extension.id === 'ije.esm-vscode'
					|| extension.id === 'johnsoncodehk.vscode-tsslint'
					|| extension.id === 'VisualStudioExptTeam.vscodeintellicode'
					|| extension.id === 'bierner.lit-html'
					|| (extension.id === 'denoland.vscode-deno' && !vscode.workspace.getConfiguration('deno').get<boolean>('enable'))
					|| extension.id === 'jenkey2011.string-highlight'
				) {
					continue;
				}
				else {
					unknownExtensions.push(extension.id);
				}
			}
		}
		if (unknownExtensions.length) {
			if (report) {
				vscode.window.showInformationMessage(
					`Hybrid Mode is disabled automatically because there is a potentially incompatible ${unknownExtensions.join(', ')} TypeScript plugin installed.`,
					'Open Settings',
					'Report a false positive',
				).then(value => {
					if (value === 'Open Settings') {
						vscode.commands.executeCommand('workbench.action.openSettings', 'vue.server.hybridMode');
					}
					else if (value == 'Report a false positive') {
						vscode.env.openExternal(vscode.Uri.parse('https://github.com/vuejs/language-tools/pull/4206'));
					}
				});
			}
			return false;
		}
		const vscodeTsdkVersion = getVScodeTsdkVersion();
		const workspaceTsdkVersion = getWorkspaceTsdkVersion();
		if (
			(vscodeTsdkVersion && !semver.gte(vscodeTsdkVersion, '5.3.0'))
			|| (workspaceTsdkVersion && !semver.gte(workspaceTsdkVersion, '5.3.0'))
		) {
			if (report) {
				let msg = `Hybrid Mode is disabled automatically because TSDK >= 5.3.0 is required (VSCode TSDK: ${vscodeTsdkVersion}`;
				if (workspaceTsdkVersion) {
					msg += `, Workspace TSDK: ${workspaceTsdkVersion}`;
				}
				msg += `).`;
				vscode.window.showInformationMessage(msg, 'Open Settings').then(value => {
					if (value === 'Open Settings') {
						vscode.commands.executeCommand('workbench.action.openSettings', 'vue.server.hybridMode');
					}
				});
			}
			return false;
		}
		return true;
	}
	else {
		return config.server.hybridMode;
	}

	function getVScodeTsdkVersion() {
		const nightly = vscode.extensions.getExtension('ms-vscode.vscode-typescript-next');
		if (nightly) {
			const libPath = path.join(
				nightly.extensionPath.replace(/\\/g, '/'),
				'node_modules/typescript/lib',
			);
			return getTsVersion(libPath);
		}

		if (vscode.env.appRoot) {
			const libPath = path.join(
				vscode.env.appRoot.replace(/\\/g, '/'),
				'extensions/node_modules/typescript/lib',
			);
			return getTsVersion(libPath);
		}
	}

	function getWorkspaceTsdkVersion() {
		const libPath = vscode.workspace.getConfiguration('typescript').get<string>('tsdk')?.replace(/\\/g, '/');
		if (libPath) {
			return getTsVersion(libPath);
		}
	}

	function getTsVersion(libPath: string): string | undefined {
		try {
			const p = libPath.toString().split('/');
			const p2 = p.slice(0, -1);
			const modulePath = p2.join('/');
			const filePath = modulePath + '/package.json';
			const contents = fs.readFileSync(filePath, 'utf-8');

			if (contents === undefined) {
				return;
			}

			let desc: any = null;
			try {
				desc = JSON.parse(contents);
			} catch (err) {
				return;
			}
			if (!desc || !desc.version) {
				return;
			}

			return desc.version;
		} catch { }
	}
}

async function doActivate(context: vscode.ExtensionContext, createLc: CreateLanguageClient) {

	getCurrentHybridModeStatus(true);

	const outputChannel = vscode.window.createOutputChannel('Vue Language Server');

	vscode.commands.executeCommand('setContext', 'vue.activated', true);

	client = createLc(
		'vue',
		'Vue',
		getDocumentSelector(),
		await getInitializationOptions(context, enabledHybridMode),
		6009,
		outputChannel
	);

	const selectors: vscode.DocumentFilter[] = [{ language: 'vue' }];

	if (config.server.petiteVue.supportHtmlFile) {
		selectors.push({ language: 'html' });
	}
	if (config.server.vitePress.supportMdFile) {
		selectors.push({ language: 'markdown' });
	}

	activateConfigWatcher();
	activateRestartRequest();

	nameCasing.activate(context, client, selectors);
	splitEditors.register(context, client);
	doctor.register(context, client);

	lsp.activateAutoInsertion(selectors, client);
	lsp.activateDocumentDropEdit(selectors, client);
	lsp.activateWriteVirtualFiles('vue.action.writeVirtualFiles', client);
	lsp.activateServerSys(client);

	if (!enabledHybridMode) {
		lsp.activateTsConfigStatusItem(selectors, 'vue.tsconfig', client);
		lsp.activateTsVersionStatusItem(selectors, 'vue.tsversion', context, client, text => 'TS ' + text);
		lsp.activateFindFileReferences('vue.findAllFileReferences', client);
	}

	const hybridModeStatus = vscode.languages.createLanguageStatusItem('vue-hybrid-mode', selectors);
	hybridModeStatus.text = 'Hybrid Mode';
	hybridModeStatus.detail = (enabledHybridMode ? 'Enabled' : 'Disabled') + (config.server.hybridMode === 'auto' ? ' (Auto)' : '');
	hybridModeStatus.command = {
		title: 'Open Setting',
		command: 'workbench.action.openSettings',
		arguments: ['vue.server.hybridMode'],
	};
	if (!enabledHybridMode) {
		hybridModeStatus.severity = vscode.LanguageStatusSeverity.Warning;
	}

	const item = vscode.languages.createLanguageStatusItem('vue-insider', 'vue');
	if (!context.extension.packageJSON.version.includes('-insider')) {
		item.text = '✨ Get Insiders Edition';
		item.severity = vscode.LanguageStatusSeverity.Warning;
	}
	else {
		item.text = '🚀 Insiders Edition';
	}
	item.detail = 'Checking for Updates...';
	item.busy = true;
	fetch('https://raw.githubusercontent.com/vuejs/language-tools/HEAD/insiders.json')
		.then(res => res.json())
		.then((json: {
			latest: string;
			versions: {
				version: string;
				date: string;
				downloads: {
					GitHub: string;
					AFDIAN: string;
				};
			}[];
		}) => {
			item.detail = undefined;
			item.command = {
				title: 'Select Version',
				command: 'vue-insiders.update',
			};
			if (json.versions.some(version => version.version === context.extension.packageJSON.version)) {
				item.detail = 'New Version Available!';
				item.severity = vscode.LanguageStatusSeverity.Warning;
			}
			vscode.commands.registerCommand('vue-insiders.update', async () => {
				const quickPickItems: { [version: string]: vscode.QuickPickItem; } = {};
				for (const { version, date } of json.versions) {
					let description = date;
					if (context.extension.packageJSON.version === version) {
						description += ' (current)';
					}
					quickPickItems[version] = {
						label: version,
						description,
					};
				}
				const version = await quickPick([quickPickItems, {
					learnMore: {
						label: 'Learn more about Insiders Edition',
					},
					joinViaGitHub: {
						label: 'Join via GitHub Sponsors',
					},
					joinViaAFDIAN: {
						label: 'Join via AFDIAN (爱发电)',
					},
				}]);
				if (version === 'learnMore') {
					vscode.env.openExternal(vscode.Uri.parse('https://github.com/vuejs/language-tools/wiki/Get-Insiders-Edition'));
				}
				else if (version === 'joinViaGitHub') {
					vscode.env.openExternal(vscode.Uri.parse('https://github.com/sponsors/johnsoncodehk'));
				}
				else if (version === 'joinViaAFDIAN') {
					vscode.env.openExternal(vscode.Uri.parse('https://afdian.net/a/johnsoncodehk'));
				}
				else {
					const downloads = json.versions.find(v => v.version === version)?.downloads;
					if (downloads) {
						const quickPickItems: { [key: string]: vscode.QuickPickItem; } = {
							GitHub: {
								label: `${version} - GitHub Releases`,
								description: 'Access via GitHub Sponsors',
								detail: downloads.GitHub,
							},
							AFDIAN: {
								label: `${version} - Insiders 电圈`,
								description: 'Access via AFDIAN (爱发电)',
								detail: downloads.AFDIAN,
							},
						};
						const otherItems: { [key: string]: vscode.QuickPickItem; } = {
							learnMore: {
								label: 'Learn more about Insiders Edition',
							},
							joinViaGitHub: {
								label: 'Join via GitHub Sponsors',
							},
							joinViaAFDIAN: {
								label: 'Join via AFDIAN (爱发电)',
							},
						};
						const option = await quickPick([quickPickItems, otherItems]);
						if (option === 'learnMore') {
							vscode.env.openExternal(vscode.Uri.parse('https://github.com/vuejs/language-tools/wiki/Get-Insiders-Edition'));
						}
						else if (option === 'joinViaGitHub') {
							vscode.env.openExternal(vscode.Uri.parse('https://github.com/sponsors/johnsoncodehk'));
						}
						else if (option === 'joinViaAFDIAN') {
							vscode.env.openExternal(vscode.Uri.parse('https://afdian.net/a/johnsoncodehk'));
						}
						else if (option) {
							vscode.env.openExternal(vscode.Uri.parse(downloads[option as keyof typeof downloads]));
						}
					}
				}
			});
		})
		.catch(() => {
			item.detail = 'Failed to Fetch Versions';
			item.severity = vscode.LanguageStatusSeverity.Warning;
		})
		.finally(() => {
			item.busy = false;
		});

	async function requestReloadVscode(msg: string) {
		const reload = await vscode.window.showInformationMessage(msg, 'Reload Window');
		if (reload === undefined) {
			return; // cancel
		}
		vscode.commands.executeCommand('workbench.action.reloadWindow');
	}

	function activateConfigWatcher() {
		context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('vue.server.hybridMode')) {
				const newHybridModeStatus = getCurrentHybridModeStatus();
				const newTypeScriptPluginStatus = getCurrentTypeScriptPluginStatus(newHybridModeStatus);
				if (newHybridModeStatus !== enabledHybridMode) {
					requestReloadVscode(
						newHybridModeStatus
							? 'Please reload VSCode to enable Hybrid Mode.'
							: 'Please reload VSCode to disable Hybrid Mode.'
					);
				}
				else if (newTypeScriptPluginStatus !== enabledTypeScriptPlugin) {
					requestReloadVscode(
						newTypeScriptPluginStatus
							? 'Please reload VSCode to enable Vue TypeScript Plugin.'
							: 'Please reload VSCode to disable Vue TypeScript Plugin.'
					);
				}
			}
			else if (e.affectsConfiguration('vue')) {
				vscode.commands.executeCommand('vue.action.restartServer', false);
			}
		}));
	}

	async function activateRestartRequest() {
		context.subscriptions.push(vscode.commands.registerCommand('vue.action.restartServer', async (restartTsServer: boolean = true) => {
			if (restartTsServer) {
				await vscode.commands.executeCommand('typescript.restartTsServer');
			}
			await client.stop();
			outputChannel.clear();
			client.clientOptions.initializationOptions = await getInitializationOptions(context, enabledHybridMode);
			await client.start();
			nameCasing.activate(context, client, selectors);
		}));
	}
}

export function deactivate(): Thenable<any> | undefined {
	return client?.stop();
}

export function getDocumentSelector(): lsp.DocumentFilter[] {
	const selectors: lsp.DocumentFilter[] = [];
	selectors.push({ language: 'vue' });
	if (config.server.petiteVue.supportHtmlFile) {
		selectors.push({ language: 'html' });
	}
	if (config.server.vitePress.supportMdFile) {
		selectors.push({ language: 'markdown' });
	}
	return selectors;
}

async function getInitializationOptions(
	context: vscode.ExtensionContext,
	hybridMode: boolean,
): Promise<VueInitializationOptions> {
	return {
		// volar
		diagnosticModel: config.server.diagnosticModel === 'pull' ? DiagnosticModel.Pull : DiagnosticModel.Push,
		typescript: { tsdk: (await lsp.getTsdk(context)).tsdk },
		maxFileSize: config.server.maxFileSize,
		semanticTokensLegend: {
			tokenTypes: [],
			tokenModifiers: [],
		},
		vue: {
			hybridMode,
			additionalExtensions: [
				...config.server.additionalExtensions,
				...!config.server.petiteVue.supportHtmlFile ? [] : ['html'],
				...!config.server.vitePress.supportMdFile ? [] : ['md'],
			],
		},
	};
};
