import * as lsp from '@volar/vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
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
import { activate as activateSplitEditors } from './features/splitEditors';
import { checkCompatible } from './hybridMode';
import { useInsidersStatusItem } from './insiders';

let client: lsp.BaseLanguageClient;

type CreateLanguageClient = (
	id: string,
	name: string,
	langs: lsp.DocumentSelector,
	port: number,
	outputChannel: vscode.OutputChannel
) => lsp.BaseLanguageClient;

export function activate(
	context: vscode.ExtensionContext,
	createLc: CreateLanguageClient
) {
	const activeTextEditor = useActiveTextEditor();
	const visibleTextEditors = useVisibleTextEditors();

	checkCompatible();

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

	// Setup typescript.js in production mode
	if (fs.existsSync(path.join(__dirname, 'server.js'))) {
		fs.writeFileSync(path.join(__dirname, 'typescript.js'), `module.exports = require("${vscode.env.appRoot.replace(/\\/g, '/')}/extensions/node_modules/typescript/lib/typescript.js");`);
	}

	client = createLc(
		'vue',
		'Vue',
		selectors,
		6009,
		outputChannel
	);

	watch(() => config.server.includeLanguages, () => {
		requestRestartExtensionHost(
			'Please restart extension host to apply the new language settings.'
		);
	});

	useCommand('vue.action.restartServer', async (restartTsServer: boolean = true) => {
		if (restartTsServer) {
			await executeCommand('typescript.restartTsServer');
		}
		await client.stop();
		outputChannel.clear();
		await client.start();
	});

	activateSplitEditors(client);

	lsp.activateAutoInsertion(selectors, client);
	lsp.activateDocumentDropEdit(selectors, client);

	useInsidersStatusItem(context);

	async function requestRestartExtensionHost(msg: string) {
		const reload = await vscode.window.showInformationMessage(msg, 'Restart Extension Host');
		if (reload) {
			executeCommand('workbench.action.restartExtensionHost');
		}
	}
}
