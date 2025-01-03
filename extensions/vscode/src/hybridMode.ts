import * as fs from 'node:fs';
import * as path from 'node:path';
import { computed, executeCommand, useAllExtensions, useVscodeContext, watchEffect } from 'reactive-vscode';
import * as semver from 'semver';
import * as vscode from 'vscode';
import { incompatibleExtensions, unknownExtensions } from './compatibility';
import { config } from './config';

const extensions = useAllExtensions();

export const enabledHybridMode = computed(() => {
	if (config.server.hybridMode === 'typeScriptPluginOnly') {
		return false;
	}
	else if (config.server.hybridMode === 'auto') {
		if (
			incompatibleExtensions.value.length ||
			unknownExtensions.value.length
		) {
			return false;
		}
		else if (
			(vscodeTsdkVersion.value && !semver.gte(vscodeTsdkVersion.value, '5.3.0')) ||
			(workspaceTsdkVersion.value && !semver.gte(workspaceTsdkVersion.value, '5.3.0'))
		) {
			return false;
		}
		return true;
	}
	return config.server.hybridMode;
});

export const enabledTypeScriptPlugin = computed(() => {
	return (
		enabledHybridMode.value ||
		config.server.hybridMode === 'typeScriptPluginOnly'
	);
});

const vscodeTsdkVersion = computed(() => {
	const nightly = extensions.value.find(
		({ id }) => id === 'ms-vscode.vscode-typescript-next'
	);
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
	const libPath = vscode.workspace
		.getConfiguration('typescript')
		.get<string>('tsdk')
		?.replace(/\\/g, '/');
	if (libPath) {
		return getTsVersion(libPath);
	}
});

export function useHybridModeTips() {
	useVscodeContext('vueHybridMode', enabledHybridMode);

	watchEffect(() => {
		if (config.server.hybridMode === 'auto') {
			if (
				incompatibleExtensions.value.length ||
				unknownExtensions.value.length
			) {
				vscode.window
					.showInformationMessage(
						`Hybrid Mode is disabled automatically because there is a potentially incompatible ${[
							...incompatibleExtensions.value,
							...unknownExtensions.value,
						].join(', ')} TypeScript plugin installed.`,
						'Open Settings',
						'Report a false positive'
					)
					.then(value => {
						if (value === 'Open Settings') {
							executeCommand(
								'workbench.action.openSettings',
								'vue.server.hybridMode'
							);
						}
						else if (value == 'Report a false positive') {
							vscode.env.openExternal(
								vscode.Uri.parse(
									'https://github.com/vuejs/language-tools/pull/4206'
								)
							);
						}
					});
			}
			else if (
				(vscodeTsdkVersion.value && !semver.gte(vscodeTsdkVersion.value, '5.3.0')) ||
				(workspaceTsdkVersion.value && !semver.gte(workspaceTsdkVersion.value, '5.3.0'))
			) {
				let msg = `Hybrid Mode is disabled automatically because TSDK >= 5.3.0 is required (VSCode TSDK: ${vscodeTsdkVersion.value}`;
				if (workspaceTsdkVersion.value) {
					msg += `, Workspace TSDK: ${workspaceTsdkVersion.value}`;
				}
				msg += `).`;
				vscode.window
					.showInformationMessage(msg, 'Open Settings')
					.then(value => {
						if (value === 'Open Settings') {
							executeCommand(
								'workbench.action.openSettings',
								'vue.server.hybridMode'
							);
						}
					});
			}
		}
		else if (config.server.hybridMode && incompatibleExtensions.value.length) {
			vscode.window
				.showWarningMessage(
					`You have explicitly enabled Hybrid Mode, but you have installed known incompatible extensions: ${incompatibleExtensions.value.join(
						', '
					)}. You may want to change vue.server.hybridMode to "auto" to avoid compatibility issues.`,
					'Open Settings',
					'Report a false positive'
				)
				.then(value => {
					if (value === 'Open Settings') {
						executeCommand(
							'workbench.action.openSettings',
							'vue.server.hybridMode'
						);
					}
					else if (value == 'Report a false positive') {
						vscode.env.openExternal(
							vscode.Uri.parse(
								'https://github.com/vuejs/language-tools/pull/4206'
							)
						);
					}
				});
		}
	});
}

export function useHybridModeStatusItem() {
	const item = vscode.languages.createLanguageStatusItem(
		'vue-hybrid-mode',
		config.server.includeLanguages
	);

	item.text = 'Hybrid Mode';
	item.detail =
		(enabledHybridMode.value ? 'Enabled' : 'Disabled') +
		(config.server.hybridMode === 'auto' ? ' (Auto)' : '');
	item.command = {
		title: 'Open Setting',
		command: 'workbench.action.openSettings',
		arguments: ['vue.server.hybridMode'],
	};

	if (!enabledHybridMode.value) {
		item.severity = vscode.LanguageStatusSeverity.Warning;
	}
}

function getTsVersion(libPath: string) {
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
		}
		catch (err) {
			return;
		}
		if (!desc || !desc.version) {
			return;
		}

		return desc.version as string;
	} catch { }
}
