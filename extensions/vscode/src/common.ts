import {
	// activateAutoInsertion,
	// activateDocumentDropEdit,
	// activateFindFileReferences,
	// activateReloadProjects,
	activateServerSys,
	// activateTsConfigStatusItem,
	// activateTsVersionStatusItem,
	// activateWriteVirtualFiles,
	getTsdk,
	takeOverModeActive
} from '@volar/vscode';
import { DiagnosticModel, ServerMode, VueServerInitializationOptions } from '@vue/language-server';
import * as vscode from 'vscode';
import * as lsp from 'vscode-languageclient';
import { config } from './config';
// import * as componentMeta from './features/componentMeta';
// import * as doctor from './features/doctor';
// import * as nameCasing from './features/nameCasing';
import * as splitEditors from './features/splitEditors';

let client: lsp.BaseLanguageClient;

type CreateLanguageClient = (
	id: string,
	name: string,
	langs: lsp.DocumentFilter[],
	initOptions: VueServerInitializationOptions,
	port: number,
	outputChannel: vscode.OutputChannel,
) => lsp.BaseLanguageClient;

export async function activate(context: vscode.ExtensionContext, createLc: CreateLanguageClient) {

	const stopCheck = vscode.window.onDidChangeActiveTextEditor(tryActivate);
	tryActivate();

	function tryActivate() {

		if (!vscode.window.activeTextEditor) {
			// onWebviewPanel:preview
			doActivate(context, createLc);
			stopCheck.dispose();
			return;
		}

		const currentLangId = vscode.window.activeTextEditor.document.languageId;
		if (currentLangId === 'vue' || (currentLangId === 'markdown' && config.server.vitePress.supportMdFile) || (currentLangId === 'html' && config.server.petiteVue.supportHtmlFile)) {
			doActivate(context, createLc);
			stopCheck.dispose();
		}

		const takeOverMode = takeOverModeActive(context);
		if (takeOverMode && ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(currentLangId)) {
			doActivate(context, createLc);
			stopCheck.dispose();
		}
	}
}

async function doActivate(context: vscode.ExtensionContext, createLc: CreateLanguageClient) {

	vscode.commands.executeCommand('setContext', 'volar.activated', true);

	const outputChannel = vscode.window.createOutputChannel('Vue Language Server');

	client = createLc(
		'vue-server',
		'Vue Server',
		getDocumentSelector(context, ServerMode.Semantic),
		await getInitializationOptions(ServerMode.Semantic, context),
		6009,
		outputChannel
	);

	activateServerMaxOldSpaceSizeChange();
	activateRestartRequest();
	activateClientRequests();

	splitEditors.register(context, client);
	// doctor.register(context, client);
	// componentMeta.register(context, client);

	// const supportedLanguages: Record<string, boolean> = {
	// 	vue: true,
	// 	markdown: true,
	// 	javascript: true,
	// 	typescript: true,
	// 	javascriptreact: true,
	// 	typescriptreact: true,
	// };
	const selectors: vscode.DocumentFilter[] = [{ language: 'vue' }];

	if (config.server.petiteVue.supportHtmlFile) {
		selectors.push({ language: 'html' });
	}
	if (config.server.vitePress.supportMdFile) {
		selectors.push({ language: 'markdown' });
	}

	// activateAutoInsertion([client], document => supportedLanguages[document.languageId]);
	// activateDocumentDropEdit(selectors, client);
	// activateWriteVirtualFiles('volar.action.writeVirtualFiles', client);
	// activateFindFileReferences('volar.vue.findAllFileReferences', client);
	// activateTsConfigStatusItem('volar.openTsconfig', client,
	// 	document => {
	// 		return document.languageId === 'vue'
	// 			|| (config.server.vitePress.supportMdFile && document.languageId === 'markdown')
	// 			|| (config.server.petiteVue.supportHtmlFile && document.languageId === 'html')
	// 			|| (
	// 				takeOverModeActive(context)
	// 				&& ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(document.languageId)
	// 			);
	// 	},
	// );
	// activateReloadProjects('volar.action.reloadProject', [client]);
	// activateTsVersionStatusItem('volar.selectTypeScriptVersion', context, client,
	// 	document => {
	// 		return document.languageId === 'vue'
	// 			|| (config.server.vitePress.supportMdFile && document.languageId === 'markdown')
	// 			|| (config.server.petiteVue.supportHtmlFile && document.languageId === 'html')
	// 			|| (
	// 				takeOverModeActive(context)
	// 				&& ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(document.languageId)
	// 			);
	// 	},
	// 	text => {
	// 		if (takeOverModeActive(context)) {
	// 			text += ' (takeover)';
	// 		}
	// 		return text;
	// 	},
	// 	false,
	// );

	activateServerSys(client);

	async function requestReloadVscode() {
		const reload = await vscode.window.showInformationMessage(
			'Please reload VSCode to restart language servers.',
			'Reload Window'
		);
		if (reload === undefined) return; // cancel
		vscode.commands.executeCommand('workbench.action.reloadWindow');
	}

	function activateServerMaxOldSpaceSizeChange() {
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration('vue.server.runtime') || e.affectsConfiguration('vue.server.path')) {
				requestReloadVscode();
			}
			if (e.affectsConfiguration('vue')) {
				vscode.commands.executeCommand('volar.action.restartServer');
			}
		});
	}

	async function activateRestartRequest() {
		context.subscriptions.push(vscode.commands.registerCommand('volar.action.restartServer', async () => {

			await client.stop();

			outputChannel.clear();

			client.clientOptions.initializationOptions = await getInitializationOptions(ServerMode.Semantic, context, client.clientOptions.initializationOptions);

			await client.start();

			activateClientRequests();
		}));
	}

	function activateClientRequests() {
		// nameCasing.activate(context, client);
	}
}

export function deactivate(): Thenable<any> | undefined {
	return client?.stop();
}

export function getDocumentSelector(context: vscode.ExtensionContext, serverMode: ServerMode): lsp.DocumentFilter[] {
	const takeOverMode = takeOverModeActive(context);
	const selectors: lsp.DocumentFilter[] = [];
	selectors.push({ language: 'vue' });
	if (takeOverMode) {
		selectors.push({ language: 'javascript' });
		selectors.push({ language: 'typescript' });
		selectors.push({ language: 'javascriptreact' });
		selectors.push({ language: 'typescriptreact' });
		if (serverMode === ServerMode.Semantic || serverMode === ServerMode.PartialSemantic) { // #2573
			// support find references for .json files
			selectors.push({ language: 'json' });
			// comment out to avoid #2648 for now
			// // support document links for tsconfig.json
			// selectors.push({ language: 'jsonc', pattern: '**/[jt]sconfig.json' });
			// selectors.push({ language: 'jsonc', pattern: '**/[jt]sconfig.*.json' });
		}
	}
	if (config.server.petiteVue.supportHtmlFile) {
		selectors.push({ language: 'html' });
	}
	if (config.server.vitePress.supportMdFile) {
		selectors.push({ language: 'markdown' });
	}
	return selectors;
}

async function getInitializationOptions(
	serverMode: ServerMode,
	context: vscode.ExtensionContext,
	options: VueServerInitializationOptions = {},
) {
	// volar
	options.configFilePath = config.server.configFilePath;
	options.serverMode = serverMode,
		options.diagnosticModel = config.server.diagnosticModel === 'pull' ? DiagnosticModel.Pull : DiagnosticModel.Push,
		options.typescript = { tsdk: (await getTsdk(context)).tsdk },
		options.reverseConfigFilePriority = config.server.reverseConfigFilePriority,
		options.maxFileSize = config.server.maxFileSize,
		options.semanticTokensLegend = {
			tokenTypes: ['component'],
			tokenModifiers: [],
		};
	options.fullCompletionList = config.server.fullCompletionList;
	options.additionalExtensions = [
		...config.server.additionalExtensions,
		...!config.server.petiteVue.supportHtmlFile ? [] : ['html'],
		...!config.server.vitePress.supportMdFile ? [] : ['md'],
	];
	return options;
}
