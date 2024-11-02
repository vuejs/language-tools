import { computed, useAllExtensions } from 'reactive-vscode';
import * as semver from 'semver';
import * as vscode from 'vscode';

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
