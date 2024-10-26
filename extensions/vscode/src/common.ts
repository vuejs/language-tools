import * as lsp from '@volar/vscode';
import { quickPick } from '@volar/vscode/lib/common';
import type { VueInitializationOptions } from '@vue/language-server';
import * as fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';
import * as vscode from 'vscode';
import { computed, executeCommand, ref, useAllExtensions, watchEffect, useActiveTextEditor, useVisibleTextEditors, watch, useOutputChannel, useCommand } from 'reactive-vscode';
import { config } from './config';
import * as doctor from './features/doctor';
import * as nameCasing from './features/nameCasing';
import * as splitEditors from './features/splitEditors';

let client: lsp.BaseLanguageClient;

type CreateLanguageClient = (
	id: string,
	name: string,
	langs: lsp.DocumentSelector,
	initOptions: VueInitializationOptions,
	port: number,
	outputChannel: vscode.OutputChannel,
) => lsp.BaseLanguageClient;

export const enabledHybridMode = ref<boolean>(true);
export const enabledTypeScriptPlugin = computed(() => {
	return enabledHybridMode.value || config.server.value.hybridMode === 'typeScriptPluginOnly';
});

const extensions = useAllExtensions();

const incompatibleExtensions = computed(() => {
	return extensions.value
		.filter((ext) => isExtensionCompatibleWithHybridMode(ext) === false)
		.map((ext) => ext.id);
});

const unknownExtensions = computed(() => {
	return extensions.value
		.filter((ext) => isExtensionCompatibleWithHybridMode(ext) === undefined && !!ext.packageJSON?.contributes?.typescriptServerPlugins)
		.map((ext) => ext.id);
});

const vscodeTsdkVersion = computed(() => {
	const nightly = extensions.value.find(({ id }) => id === 'ms-vscode.vscode-typescript-next');
	if (nightly) {
		const libPath = path.join(
			nightly.extensionPath.replace(/\\/g, '/'),
			'node_modules/typescript/lib'
		);
		return getTsVersion(libPath);
	}

	if (vscode.env.appRoot) {
		const libPath = path.join(
			vscode.env.appRoot.replace(/\\/g, '/'),
			'extensions/node_modules/typescript/lib'
		);
		return getTsVersion(libPath);
	}
});

const workspaceTsdkVersion = computed(() => {
	const libPath = vscode.workspace.getConfiguration('typescript').get<string>('tsdk')?.replace(/\\/g, '/');
	if (libPath) {
		return getTsVersion(libPath);
	}
});

watchEffect(() => {
	switch (config.server.value.hybridMode) {
		case 'typeScriptPluginOnly': {
			enabledHybridMode.value = false;
			break;
		}
		case 'auto': {
			if (incompatibleExtensions.value.length || unknownExtensions.value.length) {
				vscode.window.showInformationMessage(
					`Hybrid Mode is disabled automatically because there is a potentially incompatible ${[...incompatibleExtensions.value, ...unknownExtensions.value].join(', ')} TypeScript plugin installed.`,
					'Open Settings',
					'Report a false positive'
				).then(value => {
					if (value === 'Open Settings') {
						executeCommand('workbench.action.openSettings', 'vue.server.hybridMode');
					}
					else if (value == 'Report a false positive') {
						vscode.env.openExternal(vscode.Uri.parse('https://github.com/vuejs/language-tools/pull/4206'));
					}
				});
				enabledHybridMode.value = false;
			}
			else if (
				(vscodeTsdkVersion.value && !semver.gte(vscodeTsdkVersion.value, '5.3.0'))
				|| (workspaceTsdkVersion.value && !semver.gte(workspaceTsdkVersion.value, '5.3.0'))
			) {
				let msg = `Hybrid Mode is disabled automatically because TSDK >= 5.3.0 is required (VSCode TSDK: ${vscodeTsdkVersion.value}`;
				if (workspaceTsdkVersion.value) {
					msg += `, Workspace TSDK: ${workspaceTsdkVersion.value}`;
				}
				msg += `).`;
				vscode.window.showInformationMessage(msg, 'Open Settings').then(value => {
					if (value === 'Open Settings') {
						executeCommand('workbench.action.openSettings', 'vue.server.hybridMode');
					}
				});
				enabledHybridMode.value = false;
			}
			else {
				enabledHybridMode.value = true;
			}
			break;
		}
		default: {
			if (config.server.value.hybridMode && incompatibleExtensions.value.length) {
				vscode.window.showWarningMessage(
					`You have explicitly enabled Hybrid Mode, but you have installed known incompatible extensions: ${incompatibleExtensions.value.join(', ')}. You may want to change vue.server.hybridMode to "auto" to avoid compatibility issues.`,
					'Open Settings',
					'Report a false positive'
				).then(value => {
					if (value === 'Open Settings') {
						executeCommand('workbench.action.openSettings', 'vue.server.hybridMode');
					}
					else if (value == 'Report a false positive') {
						vscode.env.openExternal(vscode.Uri.parse('https://github.com/vuejs/language-tools/pull/4206'));
					}
				});
			}
			enabledHybridMode.value = config.server.value.hybridMode;
		}
	}
});

export function activate(context: vscode.ExtensionContext, createLc: CreateLanguageClient) {
	const activeTextEditor = useActiveTextEditor();
	const visibleTextEditors = useVisibleTextEditors();
	const outputChannel = useOutputChannel('Vue Language Server');

	executeCommand('setContext', 'vueHybridMode', enabledHybridMode.value);

	const { stop } = watch(activeTextEditor, async () => {
		if (visibleTextEditors.value.every(editor => !config.server.value.includeLanguages.includes(editor.document.languageId))) {
			return;
		}

		executeCommand('setContext', 'vue.activated', true);

		const selectors = config.server.value.includeLanguages;

		client = createLc(
			'vue',
			'Vue',
			selectors,
			await getInitializationOptions(context, enabledHybridMode.value),
			6009,
			outputChannel
		);

		watch([enabledHybridMode, enabledTypeScriptPlugin], (newValues, oldValues) => {
			if (newValues[0] !== oldValues[0]) {
				requestReloadVSCode(
					newValues[0]
						? 'Please reload VSCode to enable Hybrid Mode.'
						: 'Please reload VSCode to disable Hybrid Mode.'
				);
			}
			else if (newValues[1] !== oldValues[1]) {
				requestReloadVSCode(
					newValues[1]
						? 'Please reload VSCode to enable Vue TypeScript Plugin.'
						: 'Please reload VSCode to disable Vue TypeScript Plugin.'
				);
			}
		});

		watch(() => config.server.value.includeLanguages, () => {
			if (enabledHybridMode.value) {
				requestReloadVSCode('Please reload VSCode to apply the new language settings.');
			}
		});

		watch(config.server, () => {
			if (!enabledHybridMode.value) {
				executeCommand('vue.action.restartServer', false);
			}
		});

		watch(Object.values(config).filter((conf) => conf !== config.server), () => {
			executeCommand('vue.action.restartServer', false);
		});

		useCommand('vue.action.restartServer', async (restartTsServer: boolean = true) => {
			if (restartTsServer) {
				await executeCommand('typescript.restartTsServer');
			}
			await client.stop();
			outputChannel.clear();
			client.clientOptions.initializationOptions = await getInitializationOptions(context, enabledHybridMode.value);
			await client.start();
			nameCasing.activate(client, selectors);
		});

		doctor.register(context, client);
		nameCasing.activate(client, selectors);
		splitEditors.register(client);

		lsp.activateAutoInsertion(selectors, client);
		lsp.activateDocumentDropEdit(selectors, client);
		lsp.activateWriteVirtualFiles('vue.action.writeVirtualFiles', client);

		if (!enabledHybridMode.value) {
			lsp.activateTsConfigStatusItem(selectors, 'vue.tsconfig', client);
			lsp.activateTsVersionStatusItem(selectors, 'vue.tsversion', context, text => 'TS ' + text);
			lsp.activateFindFileReferences('vue.findAllFileReferences', client);
		}

		const hybridModeStatus = vscode.languages.createLanguageStatusItem('vue-hybrid-mode', selectors);
		hybridModeStatus.text = 'Hybrid Mode';
		hybridModeStatus.detail = (enabledHybridMode.value ? 'Enabled' : 'Disabled') + (config.server.value.hybridMode === 'auto' ? ' (Auto)' : '');
		hybridModeStatus.command = {
			title: 'Open Setting',
			command: 'workbench.action.openSettings',
			arguments: ['vue.server.hybridMode'],
		};
		if (!enabledHybridMode.value) {
			hybridModeStatus.severity = vscode.LanguageStatusSeverity.Warning;
		}

		const item = vscode.languages.createLanguageStatusItem('vue-insider', 'vue');
		item.text = 'Checking for Updates...';
		item.busy = true;
		let succeed = false;
		for (const url of [
			'https://raw.githubusercontent.com/vuejs/language-tools/HEAD/insiders.json',
			'https://cdn.jsdelivr.net/gh/vuejs/language-tools/insiders.json',
		]) {
			try {
				const res = await fetch(url);
				onJson(await res.json() as any);
				succeed = true;
				break;
			} catch { }
		}
		item.busy = false;
		if (!succeed) {
			item.text = 'Failed to Fetch Versions';
			item.severity = vscode.LanguageStatusSeverity.Error;
		}

		function onJson(json: {
			latest: string;
			versions: {
				version: string;
				date: string;
				downloads: {
					GitHub: string;
					AFDIAN: string;
				};
			}[];
		}) {
			item.detail = undefined;
			item.command = {
				title: 'Select Version',
				command: 'vue-insiders.update',
			};
			if (json.versions.some(version => version.version === context.extension.packageJSON.version)) {
				item.text = '🚀 Insiders Edition';
				item.severity = vscode.LanguageStatusSeverity.Information;
	
				if (context.extension.packageJSON.version !== json.latest) {
					item.detail = 'New Version Available!';
					item.severity = vscode.LanguageStatusSeverity.Warning;
					vscode.window
						.showInformationMessage('New Insiders Version Available!', 'Download')
						.then(download => {
							if (download) {
								executeCommand('vue-insiders.update');
							}
						});
				}
			}
			else {
				item.text = '✨ Get Insiders Edition';
				item.severity = vscode.LanguageStatusSeverity.Warning;
			}
			useCommand('vue-insiders.update', async () => {
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
		}

		async function requestReloadVSCode(msg: string) {
			const reload = await vscode.window.showInformationMessage(msg, 'Reload Window');
			if (reload === undefined) {
				return; // cancel
			}
			executeCommand('workbench.action.reloadWindow');
		}

		stop();
	}, {
		immediate: true
	})
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

export function deactivate(): Thenable<any> | undefined {
	return client?.stop();
}

async function getInitializationOptions(
	context: vscode.ExtensionContext,
	hybridMode: boolean
): Promise<VueInitializationOptions> {
	return {
		typescript: { tsdk: (await lsp.getTsdk(context))!.tsdk },
		vue: { hybridMode },
	};
};

function isExtensionCompatibleWithHybridMode(extension: vscode.Extension<any>) {
	if (
		extension.id === 'Vue.volar'
		|| extension.id === 'unifiedjs.vscode-mdx'
		|| extension.id === 'astro-build.astro-vscode'
		|| extension.id === 'ije.esm-vscode'
		|| extension.id === 'johnsoncodehk.vscode-tsslint'
		|| extension.id === 'VisualStudioExptTeam.vscodeintellicode'
		|| extension.id === 'bierner.lit-html'
		|| extension.id === 'jenkey2011.string-highlight'
		|| extension.id === 'mxsdev.typescript-explorer'
		|| extension.id === 'miaonster.vscode-tsx-arrow-definition'
		|| extension.id === 'runem.lit-plugin'
		|| extension.id === 'kimuson.ts-type-expand'
		|| extension.id === 'p42ai.refactor'
		|| extension.id === 'styled-components.vscode-styled-components'
		|| extension.id === 'Divlo.vscode-styled-jsx-languageserver'
		|| extension.id === 'nrwl.angular-console'
		|| extension.id === 'ShenQingchuan.vue-vine-extension'
		|| extension.id === 'ms-dynamics-smb.al'
	) {
		return true;
	}
	if (extension.id === 'denoland.vscode-deno') {
		return !vscode.workspace.getConfiguration('deno').get<boolean>('enable');
	}
	if (extension.id === 'svelte.svelte-vscode') {
		return semver.gte(extension.packageJSON.version, '108.4.0');
	}
}