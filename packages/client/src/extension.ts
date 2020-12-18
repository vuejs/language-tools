/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'upath';
import * as vscode from 'vscode';
import { activateTagClosing } from './tagClosing';
import { registerDocumentSemanticTokensProvider } from './semanticTokens';
import { registerDocumentFormattingEditProvider } from './format';
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind,
	Position,
	Location,
} from 'vscode-languageclient/node';
import {
	TagCloseRequest,
	LinkedEditingRangeRequest,
	VerifyAllScriptsRequest,
	FormatAllScriptsRequest,
	WriteVirtualFilesRequest,
	RestartServerNotification,
	ShowReferencesNotification,
	D3Request,
	DocumentVersionRequest,
} from '@volar/shared';

let apiClient: LanguageClient;
let docClient: LanguageClient;
let cheapClient: LanguageClient;

export async function activate(context: vscode.ExtensionContext) {
	apiClient = createLanguageService(context, path.join('packages', 'server', 'out', 'apiServer.js'), 'Volar - Basic', 6009, true);
	docClient = createLanguageService(context, path.join('packages', 'server', 'out', 'docServer.js'), 'Volar - Document', 6010, true);
	cheapClient = createLanguageService(context, path.join('packages', 'server', 'out', 'cheapServer.js'), 'Volar - HTML', 6011, false);

	(async () => {
		await apiClient.onReady();
		await docClient.onReady();
		await cheapClient.onReady();

		context.subscriptions.push(vscode.languages.registerLinkedEditingRangeProvider({ language: 'vue' }, {
			async provideLinkedEditingRanges(document: vscode.TextDocument, position: vscode.Position) {
				const param = apiClient.code2ProtocolConverter.asTextDocumentPositionParams(document, position);
				return apiClient.sendRequest(LinkedEditingRangeRequest.type, param).then(response => {
					if (response) {
						return {
							ranges: response.map(r => apiClient.protocol2CodeConverter.asRange(r))
						};
					}
					return undefined;
				});
			}
		}));
		context.subscriptions.push(docClient.onRequest(DocumentVersionRequest.type, handler => {
			const doc = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === handler.uri);
			return doc?.version;
		}));
		context.subscriptions.push(await registerDocumentSemanticTokensProvider(docClient));
		context.subscriptions.push(activateTagClosing((document, position) => {
			let param = cheapClient.code2ProtocolConverter.asTextDocumentPositionParams(document, position);
			return cheapClient.sendRequest(TagCloseRequest.type, param);
		}, { vue: true }, 'html.autoClosingTags'));
		context.subscriptions.push(vscode.commands.registerCommand('volar.action.restartServer', () => {
			apiClient.sendNotification(RestartServerNotification.type, undefined);
			docClient.sendNotification(RestartServerNotification.type, undefined);
		}));
		context.subscriptions.push(vscode.commands.registerCommand('volar.action.verifyAllScripts', () => {
			docClient.sendRequest(VerifyAllScriptsRequest.type, undefined);
		}));
		context.subscriptions.push(vscode.commands.registerCommand('volar.action.writeVirtualFiles', () => {
			docClient.sendRequest(WriteVirtualFilesRequest.type, undefined);
		}));
		context.subscriptions.push(vscode.commands.registerCommand('volar.action.formatAllScripts', async () => {
			const useTabsOptions = new Map<boolean, string>();
			useTabsOptions.set(true, 'Indent Using Tabs');
			useTabsOptions.set(false, 'Indent Using Spaces');
			const useTabs = await userPick(useTabsOptions);
			if (useTabs === undefined) return; // cancle

			const tabSizeOptions = new Map<number, string>();
			for (let i = 1; i <= 8; i++) {
				tabSizeOptions.set(i, i.toString());
			}
			const tabSize = await userPick(tabSizeOptions, 'Select Tab Size');
			if (tabSize === undefined) return; // cancle

			apiClient.sendRequest(FormatAllScriptsRequest.type, {
				insertSpaces: !useTabs,
				tabSize,
			});

			function userPick<K>(options: Map<K, string>, placeholder?: string) {
				return new Promise<K | undefined>(resolve => {
					const quickPick = vscode.window.createQuickPick();
					quickPick.items = [...options.values()].map(option => ({ label: option }));
					quickPick.placeholder = placeholder;
					quickPick.onDidChangeSelection(selection => {
						if (selection[0]) {
							for (const [key, label] of options) {
								if (selection[0].label === label) {
									resolve(key);
									quickPick.hide();
								}
							}
						}
					});
					quickPick.onDidHide(() => {
						quickPick.dispose();
						resolve(undefined);
					})
					quickPick.show();
				});
			}
		}));
		context.subscriptions.push(vscode.commands.registerCommand('volar.action.showCallGraph', async () => {
			const document = vscode.window.activeTextEditor?.document;
			if (!document) return;
			let param = apiClient.code2ProtocolConverter.asTextDocumentIdentifier(document);
			const d3 = await apiClient.sendRequest(D3Request.type, param);

			const panel = vscode.window.createWebviewPanel(
				'vueCallGraph',
				'Vue Call Graph',
				vscode.ViewColumn.One,
				{
					enableScripts: true
				}
			);
			panel.webview.html = `
	<script src="https://d3js.org/d3.v5.min.js"></script>
	<script src="https://unpkg.com/viz.js@1.8.1/viz.js" type="javascript/worker"></script>
	<script src="https://unpkg.com/d3-graphviz@2.1.0/build/d3-graphviz.min.js"></script>
	<div id="graph" style="text-align: center;"></div>
	<script>
	
		var dotIndex = 0;
		var graphviz = d3.select("#graph").graphviz()
			.zoom(false)
			.on("initEnd", render)
	
		function render() {
			var dot = \`${d3}\`;
			graphviz
				.renderDot(dot)
		}
	
	</script>
	`
		}));
		context.subscriptions.push(apiClient.onNotification(ShowReferencesNotification.type, handler => {
			const uri: string = handler.uri;
			const pos: Position = handler.position;
			const refs: Location[] = handler.references;
			vscode.commands.executeCommand(
				'editor.action.showReferences',
				vscode.Uri.parse(uri),
				new vscode.Position(pos.line, pos.character),
				refs.map(ref => new vscode.Location(
					vscode.Uri.parse(ref.uri),
					new vscode.Range(ref.range.start.line, ref.range.start.character, ref.range.end.line, ref.range.end.character),
				)),
			);
		}));
	})();

	// TODO: active by vue block lang
	startEmbeddedLanguageServices();
	registerDocumentFormattingEditProvider(cheapClient, apiClient);
}

export function deactivate(): Thenable<void> | undefined {
	return apiClient?.stop() && docClient?.stop() && cheapClient?.stop();
}

function createLanguageService(context: vscode.ExtensionContext, script: string, name: string, port: number, fileOnly: boolean) {
	// The server is implemented in node
	let serverModule = context.asAbsolutePath(script);
	// The debug options for the server
	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	let debugOptions = { execArgv: ['--nolazy', '--inspect=' + port] };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	let serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		},
	};

	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: fileOnly ?
			[
				{ scheme: 'file', language: 'vue' },
				{ scheme: 'file', language: 'typescript' },
				{ scheme: 'file', language: 'typescriptreact' },
			] : [
				{ language: 'vue' },
				{ language: 'typescript' },
				{ language: 'typescriptreact' },
			],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
		},
		initializationOptions: {
			scriptSetupRfc: vscode.workspace.getConfiguration().get('volar.scriptSetup.supportRfc'),
		},
	};


	// Create the language client and start the client.
	const client = new LanguageClient(
		name,
		serverOptions,
		clientOptions
	);

	// Start the client. This will also launch the server
	client.start();

	return client;
}
async function startEmbeddedLanguageServices() {
	const ts = vscode.extensions.getExtension('vscode.typescript-language-features');
	const css = vscode.extensions.getExtension('vscode.css-language-features');
	const html = vscode.extensions.getExtension('vscode.html-language-features');
	if (ts && !ts.isActive) {
		await ts.activate();
	}
	if (css && !css.isActive) {
		await css.activate();
	}
	if (html && !html.isActive) {
		await html.activate();
	}

	vscode.languages.setLanguageConfiguration('vue', {
		wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\$\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\s]+)/g,
	});
	vscode.languages.setLanguageConfiguration('jade', {
		wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\$\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\s]+)/g,
	});
}
