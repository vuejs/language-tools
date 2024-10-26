import * as lsp from '@volar/vscode';
import type { VueInitializationOptions } from '@vue/language-server';
import {
	executeCommand,
	nextTick,
	useActiveTextEditor,
	useVisibleTextEditors,
	useOutputChannel,
	useCommand,
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
		if (visibleTextEditors.value.some((editor) => config.server.value.includeLanguages.includes(editor.document.languageId))) {
			activateLc(context, createLc);
			nextTick(() => {
				stop();
			});
		}
	}, {
		immediate: true
	});
}

export function deactivate(): Thenable<any> | undefined {
	return client?.stop();
}

async function activateLc(
	context: vscode.ExtensionContext,
	createLc: CreateLanguageClient
) {
	useVscodeContext('vue.activated', true);
	const outputChannel = useOutputChannel('Vue Language Server');
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
			requestReloadVscode(
				newValues[0]
					? 'Please reload VSCode to enable Hybrid Mode.'
					: 'Please reload VSCode to disable Hybrid Mode.'
			);
		} else if (newValues[1] !== oldValues[1]) {
			requestReloadVscode(
				newValues[1]
					? 'Please reload VSCode to enable Vue TypeScript Plugin.'
					: 'Please reload VSCode to disable Vue TypeScript Plugin.'
			);
		}
	});

	watch(() => config.server.value.includeLanguages, () => {
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
	});

	activateDoctor(context, client);
	activateNameCasing(client, selectors);
	activateSplitEditors(client);

	lsp.activateAutoInsertion(selectors, client);
	lsp.activateDocumentDropEdit(selectors, client);
	lsp.activateWriteVirtualFiles('vue.action.writeVirtualFiles', client);

	if (!enabledHybridMode.value) {
		lsp.activateTsConfigStatusItem(selectors, 'vue.tsconfig', client);
		lsp.activateTsVersionStatusItem(selectors, 'vue.tsversion', context, (text) => 'TS ' + text);
		lsp.activateFindFileReferences('vue.findAllFileReferences', client);
	}

	useHybridModeStatusItem();
	useInsidersStatusItem(context);

	async function requestReloadVscode(msg: string) {
		const reload = await vscode.window.showInformationMessage(
			msg,
			'Reload Window'
		);
		if (reload === undefined) {
			return; // cancel
		}
		executeCommand('workbench.action.reloadWindow');
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
