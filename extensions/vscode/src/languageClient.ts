import * as lsp from '@volar/vscode';
import type { VueInitializationOptions } from '@vue/language-server';
import {
	executeCommand,
	nextTick,
	useActiveTextEditor,
	useCommand,
	useOutputChannel,
	useVisibleTextEditors,
	useVscodeContext,
	watch,
} from 'reactive-vscode';
import * as vscode from 'vscode';
import { config } from './config';
import { activate as activateDoctor } from './features/doctor';
import { activate as activateNameCasing } from './features/nameCasing';
import { activate as activateSplitEditors } from './features/splitEditors';
import { enabledHybridMode, enabledTypeScriptPlugin, useHybridModeStatusItem, useHybridModeTips } from './hybridMode';
import { useInsidersStatusItem } from './insiders';

let client: lsp.BaseLanguageClient;

type CreateLanguageClient = (
	id: string,
	name: string,
	langs: lsp.DocumentSelector,
	initOptions: VueInitializationOptions,
	port: number,
	outputChannel: vscode.OutputChannel
) => lsp.BaseLanguageClient;

export function activate(
	context: vscode.ExtensionContext,
	createLc: CreateLanguageClient
) {
	const activeTextEditor = useActiveTextEditor();
	const visibleTextEditors = useVisibleTextEditors();

	useHybridModeTips();

	const { stop } = watch(activeTextEditor, () => {
		if (visibleTextEditors.value.some(editor => config.server.includeLanguages.includes(editor.document.languageId))) {
			activateLc(context, createLc);
			nextTick(() => {
				stop();
			});
		}
	}, {
		immediate: true
	});
}

export function deactivate() {
	return client?.stop();
}

async function activateLc(
	context: vscode.ExtensionContext,
	createLc: CreateLanguageClient
) {
	useVscodeContext('vue.activated', true);
	const outputChannel = useOutputChannel('Vue Language Server');
	const selectors = config.server.includeLanguages;

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
			requestReloadVscode(
				`Please reload VSCode to ${newValues[0] ? 'enable' : 'disable'} Hybrid Mode.`
			);
		} else if (newValues[1] !== oldValues[1]) {
			requestReloadVscode(
				`Please reload VSCode to ${newValues[1] ? 'enable' : 'disable'} Vue TypeScript Plugin.`
			);
		}
	});

	watch(() => config.server.includeLanguages, () => {
		if (enabledHybridMode.value) {
			requestReloadVscode(
				'Please reload VSCode to apply the new language settings.'
			);
		}
	});

	watch(config.server, () => {
		if (!enabledHybridMode.value) {
			executeCommand('vue.action.restartServer', false);
		}
	}, { deep: true });

	useCommand('vue.action.restartServer', async (restartTsServer: boolean = true) => {
		if (restartTsServer) {
			await executeCommand('typescript.restartTsServer');
		}
		await client.stop();
		outputChannel.clear();
		client.clientOptions.initializationOptions = await getInitializationOptions(context, enabledHybridMode.value);
		await client.start();
	});

	activateDoctor(client);
	activateNameCasing(client, selectors);
	activateSplitEditors(client);

	lsp.activateAutoInsertion(selectors, client);
	lsp.activateDocumentDropEdit(selectors, client);
	lsp.activateWriteVirtualFiles('vue.action.writeVirtualFiles', client);

	if (!enabledHybridMode.value) {
		lsp.activateTsConfigStatusItem(selectors, 'vue.tsconfig', client);
		lsp.activateTsVersionStatusItem(selectors, 'vue.tsversion', context, text => 'TS ' + text);
		lsp.activateFindFileReferences('vue.findAllFileReferences', client);
	}

	useHybridModeStatusItem();
	useInsidersStatusItem(context);

	async function requestReloadVscode(msg: string) {
		const reload = await vscode.window.showInformationMessage(
			msg,
			'Reload Window'
		);
		if (reload) {
			executeCommand('workbench.action.reloadWindow');
		}
	}
}

async function getInitializationOptions(
	context: vscode.ExtensionContext,
	hybridMode: boolean
): Promise<VueInitializationOptions> {
	return {
		typescript: { tsdk: (await lsp.getTsdk(context))!.tsdk },
		vue: { hybridMode },
	};
}
