import { computed, useAllExtensions } from 'reactive-vscode';
import * as semver from 'semver';
import * as vscode from 'vscode';
import { config } from './config';

const defaultCompatibleExtensions = new Set([
	'astro-build.astro-vscode',
	'bierner.lit-html',
	'Divlo.vscode-styled-jsx-languageserver',
	'GitHub.copilot-chat',
	'ije.esm-vscode',
	'jenkey2011.string-highlight',
	'johnsoncodehk.vscode-tsslint',
	'kimuson.ts-type-expand',
	'miaonster.vscode-tsx-arrow-definition',
	'ms-dynamics-smb.al',
	'mxsdev.typescript-explorer',
	'nrwl.angular-console',
	'p42ai.refactor',
	'runem.lit-plugin',
	'ShenQingchuan.vue-vine-extension',
	'styled-components.vscode-styled-components',
	'unifiedjs.vscode-mdx',
	'VisualStudioExptTeam.vscodeintellicode',
	'Vue.volar',
]);

const extensions = useAllExtensions();

export const incompatibleExtensions = computed(() => {
	return extensions.value
		.filter(ext => isExtensionCompatibleWithHybridMode(ext) === false)
		.map(ext => ext.id);
});

export const unknownExtensions = computed(() => {
	return extensions.value
		.filter(ext => isExtensionCompatibleWithHybridMode(ext) === undefined && !!ext.packageJSON?.contributes?.typescriptServerPlugins)
		.map(ext => ext.id);
});

function isExtensionCompatibleWithHybridMode(extension: vscode.Extension<any>) {
	if (
		defaultCompatibleExtensions.has(extension.id) ||
		config.server.compatibleExtensions.includes(extension.id)
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
