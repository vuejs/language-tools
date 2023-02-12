import * as vscode from 'vscode';
import * as path from 'typesafe-path';
import * as fs from '../utils/fs';
import * as shared from '@volar/shared';
import { quickPick } from '@volar/vscode-language-client/out/common';
import * as preview from '@volar/preview';
import { getLocalHostAvailablePort } from '../utils/http';
import { BaseLanguageClient } from 'vscode-languageclient';
import { ParseSFCRequest } from '@volar/vue-language-server';

const enum PreviewType {
	Webview = 'volar-webview',
	ExternalBrowser = 'volar-start-server',
	ExternalBrowser_Component = 'volar-component-preview',
}

export async function register(context: vscode.ExtensionContext, client: BaseLanguageClient) {

	let _loadingPanel: vscode.WebviewPanel | undefined;
	let avoidUpdateOnDidChangeActiveTextEditor = false;
	let updateComponentPreview: Function | undefined;

	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, -1);
	statusBar.command = 'volar.previewMenu';
	statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
	context.subscriptions.push(statusBar);

	let connection: ReturnType<typeof preview.createPreviewConnection> | undefined;
	let highlightDomElements = true;

	const previewTerminal = vscode.window.terminals.find(terminal => terminal.name.startsWith('volar-preview:'));
	if (previewTerminal) {
		connection = preview.createPreviewConnection({
			onGotoCode: handleGoToCode,
			getFileHref: (fileName) => {
				avoidUpdateOnDidChangeActiveTextEditor = false;
				updateComponentPreview?.();
				return 'vscode://files:/' + fileName;
			},
		});
		statusBar.text = 'Preview Port: ' + previewTerminal.name.split(':')[2];
		statusBar.show();
	}
	vscode.window.onDidOpenTerminal(e => {
		if (e.name.startsWith('volar-preview:')) {
			connection = preview.createPreviewConnection({
				onGotoCode: handleGoToCode,
				getFileHref: (fileName) => {
					avoidUpdateOnDidChangeActiveTextEditor = false;
					updateComponentPreview?.();
					return 'vscode://files:/' + fileName;
				},
			});
			statusBar.text = 'Preview Port: ' + e.name.split(':')[2];
			statusBar.show();
		}
	});
	vscode.window.onDidCloseTerminal(e => {
		if (e.name.startsWith('volar-preview:')) {
			connection?.stop();
			connection = undefined;
			statusBar.hide();
		}
	});

	const sfcs = new WeakMap<vscode.TextDocument, { version: number, sfc: ParseSFCRequest.ResponseType; }>();

	class VueComponentPreview implements vscode.WebviewViewProvider {

		public resolveWebviewView(
			webviewView: vscode.WebviewView,
			_context: vscode.WebviewViewResolveContext,
			_token: vscode.CancellationToken,
		) {

			let lastPreviewDocument: vscode.TextDocument | undefined;
			let updating: Promise<void> | undefined;

			webviewView.webview.options = {
				enableScripts: true,
			};
			updateWebView(true);
			updateComponentPreview = updateWebView;

			vscode.window.onDidChangeActiveTextEditor(() => {
				if (avoidUpdateOnDidChangeActiveTextEditor)
					return;
				if (!vscode.window.activeTextEditor || lastPreviewDocument === vscode.window.activeTextEditor.document)
					return;
				updateWebView(false);
			});
			vscode.workspace.onDidChangeTextDocument(() => updateWebView(false));
			vscode.workspace.onDidChangeConfiguration(() => updateWebView(true));

			webviewView.onDidChangeVisibility(() => updateWebView(false));

			function updateWebView(refresh: boolean) {
				if (updating) {
					updating = updating.then(() => updateWebViewWorker(refresh));
				}
				else {
					updating = updateWebViewWorker(refresh);
				}
			}

			async function updateWebViewWorker(refresh: boolean) {

				if (!webviewView.visible)
					return;

				if (vscode.window.activeTextEditor?.document.languageId === 'vue')
					lastPreviewDocument = vscode.window.activeTextEditor.document;

				if (!lastPreviewDocument)
					return;

				const fileName = lastPreviewDocument.fileName as path.OsPath;
				let terminal = vscode.window.terminals.find(terminal => terminal.name.startsWith('volar-preview:'));
				let port: number;
				let configFile = await getConfigFile(fileName, 'vite');
				let previewMode: 'vite' | 'nuxt' = 'vite';

				if (!configFile) {
					configFile = await getConfigFile(fileName, 'nuxt');
					previewMode = 'nuxt';
				}
				if (!configFile)
					return;

				if (terminal) {
					port = Number(terminal.name.split(':')[2]);
				}
				else {
					const configDir = path.dirname(configFile);
					const server = await startPreviewServer(configDir, previewMode);
					terminal = server.terminal;
					port = server.port;
				}

				const root = vscode.workspace.getConfiguration('volar').get<path.PosixPath>('preview.root')!;
				const relativePath = shared.normalizeFileName(path.relative(path.resolve(path.dirname(configFile), root), fileName));
				let url = `http://localhost:${port}/__preview${relativePath}#`;

				if (lastPreviewDocument.isDirty) {
					url += btoa(lastPreviewDocument.getText());
				}

				if (refresh) {

					const bgPath = vscode.Uri.file(path.join(context.extensionPath as path.OsPath, 'images/preview-bg.png' as path.PosixPath));
					const bgSrc = webviewView.webview.asWebviewUri(bgPath);

					webviewView.webview.html = '';
					webviewView.webview.html = getWebviewContent(url, bgSrc.toString());
				}
				else {
					webviewView.webview.postMessage({
						sender: 'volar',
						command: 'updateUrl',
						data: url,
					});
				}
			}
		}
	}

	vscode.window.registerWebviewViewProvider(
		'vueComponentPreview',
		new VueComponentPreview(),
	);

	context.subscriptions.push(vscode.commands.registerCommand('volar.previewMenu', async () => {

		const baseOptions: Record<string, vscode.QuickPickItem> = {};
		const urlOptions: Record<string, vscode.QuickPickItem> = {};
		const highlight: Record<string, vscode.QuickPickItem> = {};

		baseOptions['kill'] = { label: 'Kill Preview Server' };
		baseOptions['browser'] = { label: 'Open in Browser' };
		highlight['highlight-on'] = { label: (highlightDomElements ? '• ' : '') + 'Highlight DOM Elements' };
		highlight['highlight-off'] = { label: (!highlightDomElements ? '• ' : '') + `Don't Highlight DOM Elements` };

		const key = await quickPick([baseOptions, urlOptions, highlight]);

		if (key === 'kill') {
			for (const terminal of vscode.window.terminals) {
				if (terminal.name.startsWith('volar-preview:')) {
					terminal.dispose();
				}
			}
		}
		if (key === 'browser') {
			vscode.env.openExternal(vscode.Uri.parse('http://localhost:' + statusBar.text.split(':')[2].trim()));
		}
		if (key === 'highlight-on') {
			highlightDomElements = true;
			if (vscode.window.activeTextEditor) {
				updateSelectionHighlights(vscode.window.activeTextEditor);
			}
		}
		if (key === 'highlight-off') {
			highlightDomElements = false;
			if (vscode.window.activeTextEditor) {
				updateSelectionHighlights(vscode.window.activeTextEditor);
			}
		}
	}));
	context.subscriptions.push(vscode.commands.registerCommand('volar.action.vite', async () => {

		const editor = vscode.window.activeTextEditor;
		if (!editor)
			return;

		const viteConfigFile = await getConfigFile(editor.document.fileName as path.OsPath, 'vite');
		const select = await quickPick({
			[PreviewType.Webview]: {
				label: 'Preview Vite App',
				detail: vscode.workspace.rootPath && viteConfigFile ? path.relative(vscode.workspace.rootPath as path.OsPath, viteConfigFile) : viteConfigFile,
				description: 'Press `Alt` to use go to code feature',
			},
			[PreviewType.ExternalBrowser]: {
				label: 'Preview Vite App in External Browser',
				detail: vscode.workspace.rootPath && viteConfigFile ? path.relative(vscode.workspace.rootPath as path.OsPath, viteConfigFile) : viteConfigFile,
				description: 'Press `Alt` to use go to code feature',
			},
			[PreviewType.ExternalBrowser_Component]: {
				label: `Preview Component in External Browser`,
				detail: vscode.workspace.rootPath ? path.relative(vscode.workspace.rootPath as path.OsPath, editor.document.fileName as path.OsPath) : editor.document.fileName,
			},
		});
		if (select === undefined)
			return; // cancel

		openPreview(select as PreviewType, editor.document.fileName as path.OsPath, 'vite');
	}));
	context.subscriptions.push(vscode.commands.registerCommand('volar.action.nuxt', async () => {

		const editor = vscode.window.activeTextEditor;
		if (!editor)
			return;

		const viteConfigFile = await getConfigFile(editor.document.fileName as path.OsPath, 'nuxt');
		const root = vscode.workspace.getConfiguration('volar').get<path.PosixPath>('preview.root')!;
		const select = await quickPick({
			[PreviewType.Webview]: {
				label: 'Preview Nuxt App',
				detail: vscode.workspace.rootPath && viteConfigFile ? path.relative(vscode.workspace.rootPath as path.OsPath, viteConfigFile) : viteConfigFile,
			},
			[PreviewType.ExternalBrowser]: {
				label: 'Preview Nuxt App in External Browser',
				detail: vscode.workspace.rootPath && viteConfigFile ? path.relative(vscode.workspace.rootPath as path.OsPath, viteConfigFile) : viteConfigFile,
				description: 'Press `Alt` to use go to code in Browser',
			},
			[PreviewType.ExternalBrowser_Component]: {
				label: `Preview Component in External Browser`,
				detail: vscode.workspace.rootPath ? path.relative(path.resolve(vscode.workspace.rootPath as path.OsPath, root), editor.document.fileName as path.OsPath) : editor.document.fileName,
			},
		});
		if (select === undefined)
			return; // cancel

		openPreview(select as PreviewType, editor.document.fileName as path.OsPath, 'nuxt');
	}));
	context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(e => {
		updateSelectionHighlights(e.textEditor);
	}));
	context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((e) => {
		if (vscode.window.activeTextEditor?.document === e.document) {
			updateSelectionHighlights(vscode.window.activeTextEditor);
		}
	}));
	context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document) => {
		if (vscode.window.activeTextEditor?.document === document) {
			updateSelectionHighlights(vscode.window.activeTextEditor);
		}
	}));

	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updatePreviewIconStatus));

	updatePreviewIconStatus();

	async function getSfc(document: vscode.TextDocument) {
		let cache = sfcs.get(document);
		if (!cache || cache.version !== document.version) {
			const parsed = await client.sendRequest(ParseSFCRequest.type, document.getText());
			cache = {
				version: document.version,
				sfc: parsed,
			};
			sfcs.set(document, cache);
		}
		return cache.sfc;
	}

	async function updatePreviewIconStatus() {
		if (vscode.window.activeTextEditor?.document.languageId === 'vue') {

			const viteConfigFile = await getConfigFile(vscode.window.activeTextEditor.document.fileName as path.OsPath, 'vite');
			const nuxtConfigFile = await getConfigFile(vscode.window.activeTextEditor.document.fileName as path.OsPath, 'nuxt');

			vscode.commands.executeCommand('setContext', 'volar.foundViteDir', viteConfigFile !== undefined);
			vscode.commands.executeCommand('setContext', 'volar.foundNuxtDir', nuxtConfigFile !== undefined);
		}
	}

	async function updateSelectionHighlights(textEditor: vscode.TextEditor) {
		if (connection && textEditor.document.languageId === 'vue' && highlightDomElements) {
			const sfc = await getSfc(textEditor.document);
			const offset = sfc.descriptor.template?.loc.start.offset ?? 0;
			connection.highlight(
				textEditor.document.fileName,
				textEditor.selections.map(selection => ({
					start: textEditor.document.offsetAt(selection.start) - offset,
					end: textEditor.document.offsetAt(selection.end) - offset,
				})),
				textEditor.document.isDirty,
			);
		}
		else {
			connection?.unhighlight();
		}
	}

	async function openPreview(previewType: PreviewType, fileName: path.OsPath, mode: 'vite' | 'nuxt', _panel?: vscode.WebviewPanel) {

		const configFile = await getConfigFile(fileName, mode);
		if (!configFile)
			return;

		let terminal = vscode.window.terminals.find(terminal => terminal.name.startsWith('volar-preview:'));
		let port: number;

		if (terminal) {
			port = Number(terminal.name.split(':')[2]);
		}
		else {
			const configDir = path.dirname(configFile);
			const server = await startPreviewServer(configDir, mode);
			terminal = server.terminal;
			port = server.port;
		}

		const loadingPanel = _panel ?? vscode.window.createWebviewPanel(
			previewType,
			'Preview ' + path.relative((vscode.workspace.rootPath ?? '') as path.OsPath, configFile),
			vscode.ViewColumn.Beside,
			{
				retainContextWhenHidden: true,
				enableScripts: true,
				enableFindWidget: true,
			},
		);

		const panelContext: vscode.Disposable[] = [];

		loadingPanel.onDidDispose(() => {
			for (const disposable of panelContext) {
				disposable.dispose();
			}
		});

		panelContext.push(loadingPanel.webview.onDidReceiveMessage(webviewEventHandler));

		terminal.show();
		_loadingPanel = loadingPanel;

		if (previewType === PreviewType.ExternalBrowser) {
			loadingPanel.webview.html = getWebviewContent(`http://localhost:${port}`, undefined, 'openExternal');
		}
		else if (previewType === PreviewType.ExternalBrowser_Component) {
			const root = vscode.workspace.getConfiguration('volar').get<path.PosixPath>('preview.root')!;
			const relativePath = shared.normalizeFileName(path.relative(path.resolve(path.dirname(configFile), root), fileName));
			loadingPanel.webview.html = getWebviewContent(`http://localhost:${port}/__preview${relativePath}`, undefined, 'openExternal');
		}
		else if (previewType === PreviewType.Webview) {
			loadingPanel.webview.html = getWebviewContent(`http://localhost:${port}`, undefined, 'openSimpleBrowser');
		}

		return port;

		async function webviewEventHandler(message: any) {
			switch (message.command) {
				case 'openUrl': {
					const { url, external } = message.data;
					if (external) {
						vscode.env.openExternal(vscode.Uri.parse(url));
					}
					else {
						vscode.commands.executeCommand('simpleBrowser.api.open', url, { preserveFocus: true, viewColumn: _loadingPanel?.viewColumn ?? vscode.ViewColumn.Beside });
					}
					_loadingPanel?.dispose();
					break;
				}
				case 'log': {
					const text = message.data;
					vscode.window.showInformationMessage(text);
					break;
				}
				case 'warn': {
					const text = message.data;
					vscode.window.showWarningMessage(text);
					break;
				}
				case 'error': {
					const text = message.data;
					vscode.window.showErrorMessage(text);
					break;
				}
			}
		}
	}

	async function handleGoToCode(fileName: string, range: [number, number], cancelToken: { readonly isCancelled: boolean; }) {

		avoidUpdateOnDidChangeActiveTextEditor = true;

		const doc = await vscode.workspace.openTextDocument(fileName);

		if (cancelToken.isCancelled)
			return;

		const sfc = await getSfc(doc);
		const offset = sfc.descriptor.template?.loc.start.offset ?? 0;
		const start = doc.positionAt(range[0] + offset);
		const end = doc.positionAt(range[1] + offset);
		await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);

		if (cancelToken.isCancelled)
			return;

		const editor = vscode.window.activeTextEditor;
		if (editor) {
			editor.selection = new vscode.Selection(start, end);
			editor.revealRange(new vscode.Range(start, end));
		}
	}

	async function startPreviewServer(viteDir: string, type: 'vite' | 'nuxt') {

		const port = await getLocalHostAvailablePort(vscode.workspace.getConfiguration('volar').get('preview.port')!);
		let script = await vscode.workspace.getConfiguration('volar').get<string>('preview.script.' + (type === 'nuxt' ? 'nuxi' : 'vite')) ?? '';

		if (script.indexOf('{VITE_BIN}') >= 0) {
			script = script.replace('{VITE_BIN}', JSON.stringify(require.resolve('./dist/preview-bin/vite', { paths: [context.extensionPath] })));
		}
		if (script.indexOf('{NUXI_BIN}') >= 0) {
			script = script.replace('{NUXI_BIN}', JSON.stringify(require.resolve('./dist/preview-bin/nuxi', { paths: [context.extensionPath] })));
		}
		if (script.indexOf('{PORT}') >= 0) {
			script = script.replace('{PORT}', port.toString());
		}

		const terminal = vscode.window.createTerminal({
			name: 'volar-preview:' + type + ':' + port,
			isTransient: true,
		});
		terminal.sendText(`cd ${JSON.stringify(viteDir)}`);
		terminal.sendText(script);

		return {
			port,
			terminal,
		};
	}

	async function getConfigFile(fileName: path.OsPath, mode: 'vite' | 'nuxt') {
		let dir = path.dirname(fileName);
		let configFile: path.OsPath | undefined;
		while (true) {
			const configTs = path.join(dir, mode + '.config.ts' as path.PosixPath);
			const configJs = path.join(dir, mode + '.config.js' as path.PosixPath);
			if (await fs.exists(vscode.Uri.file(configTs))) {
				configFile = configTs;
				break;
			}
			if (await fs.exists(vscode.Uri.file(configJs))) {
				configFile = configJs;
				break;
			}
			const upperDir = path.dirname(dir);
			if (upperDir === dir) {
				break;
			}
			dir = upperDir;
		}
		return configFile;
	}

	function getWebviewContent(url: string, bg?: string, onLoadEvent?: 'openExternal' | 'openSimpleBrowser') {

		const configs = vscode.workspace.getConfiguration('volar');

		let html = `
			<style>
			body {
				padding: 0;
				background-color: ${configs.get('preview.backgroundColor')};
				${bg && configs.get('preview.transparentGrid') ? `background-image: url(${bg});` : ''}
			}
			</style>

			<script>

			const vscode = acquireVsCodeApi();

			let preview;

			window.addEventListener('message', e => {
				if (e.data.sender === 'volar') {
					if (e.data.command === 'updateUrl') {
						preview.src = e.data.data;
					}
					else {
						preview.contentWindow.postMessage(e.data, '*');
					}
				}
				else {
					vscode.postMessage(e.data);
				}
			});

			const start = Date.now();

			(async () => {

				while (Date.now() - start < 10000 && !(await isServerStart())) {
					await sleep(250);
				}

				preview = document.createElement('iframe');
				preview.src = '${url}';
				preview.onload = previewFrameLoaded;
				preview.frameBorder = '0';
				preview.style.display = 'block';
				preview.style.margin = '0';
				preview.style.overflow = 'hidden';
				preview.style.width = '100%';
				preview.style.height = '0';

				document.body.append(preview);
			})();

			function previewFrameLoaded() {
				preview.onload = undefined;
				${onLoadEvent ? `
					vscode.postMessage({ command: 'openUrl', data: { url: '${url}', external: ${onLoadEvent === 'openExternal'} } });
				` : `
					preview.style.height = '100vh';
					document.getElementById('loading').remove();
				`
			}
			};
			function sleep(ms) {
				return new Promise(resolve => setTimeout(resolve, ms));
			}
			function isServerStart() {
				return new Promise(resolve => {
					fetch('${url}',{method: 'GET', headers: { accept: '*/*' } })
						.then(() => resolve(true))
						.catch(() => resolve(false))
				});
			}
			</script>

			<div id="loading">
				<div style="display: flex; align-items: center; flex-direction: column; min-height: 100vh; justify-content: space-evenly;">
					<a href="https://cdn.jsdelivr.net/gh/johnsoncodehk/sponsors/sponsors.svg" target="_top">
						<img src="https://cdn.jsdelivr.net/gh/johnsoncodehk/sponsors/sponsors.svg?time=${Math.round(Date.now() / 1000 / 3600)}" />
					</a>

					<div style="height: 35px; width: 116px; display: flex;">
						<a
							style="box-shadow: none; background-color: rgb(250, 251, 252); border-block: 1px solid rgba(27, 31, 35, 0.15); border-bottom-left-radius: 6px; border-bottom-right-radius: 6px; border-inline: 1px solid rgba(27, 31, 35, 0.15); border-start-end-radius: 6px; border-start-start-radius: 6px; caret-color: rgb(36, 41, 46); color: rgb(36, 41, 46); display: block; font-size: 14px; font-weight: 500; inline-size: 100%; line-height: 20px; padding-block: 5px; padding-inline: 16px; position: relative; text-align: center; transition-duration: 0.2s; transition-property: background-color; transition-timing-function: cubic-bezier(0.3, 0, 0.5, 1); user-select: none; vertical-align: middle; white-space: nowrap; text-decoration: none; display: inline-flex; align-items: center;"
							aria-label="Sponsor @johnsoncodehk"
							target="_top"
							href="https://github.com/sponsors/johnsoncodehk?o=esb"
						>
							<svg
								aria-hidden="true"
								height="16"
								viewBox="0 0 16 16"
								version="1.1"
								width="16"
								data-view-component="true"
								style="border-block-color: rgb(106, 115, 125); border-inline-color: rgb(106, 115, 125); caret-color: rgb(106, 115, 125); color: rgb(106, 115, 125); display: inline-block; fill: rgb(106, 115, 125); margin-inline-end: 8px; overflow: visible; transform: scale(1, 1); transition-duration: 0.15s; transition-property: transform; transition-timing-function: cubic-bezier(0.2, 0, 0.13, 2); vertical-align: text-bottom;"
							>
								<path
									fill-rule="evenodd"
									d="M4.25 2.5c-1.336 0-2.75 1.164-2.75 3 0 2.15 1.58 4.144 3.365 5.682A20.565 20.565 0 008 13.393a20.561 20.561 0 003.135-2.211C12.92 9.644 14.5 7.65 14.5 5.5c0-1.836-1.414-3-2.75-3-1.373 0-2.609.986-3.029 2.456a.75.75 0 01-1.442 0C6.859 3.486 5.623 2.5 4.25 2.5zM8 14.25l-.345.666-.002-.001-.006-.003-.018-.01a7.643 7.643 0 01-.31-.17 22.075 22.075 0 01-3.434-2.414C2.045 10.731 0 8.35 0 5.5 0 2.836 2.086 1 4.25 1 5.797 1 7.153 1.802 8 3.02 8.847 1.802 10.203 1 11.75 1 13.914 1 16 2.836 16 5.5c0 2.85-2.045 5.231-3.885 6.818a22.08 22.08 0 01-3.744 2.584l-.018.01-.006.003h-.002L8 14.25zm0 0l.345.666a.752.752 0 01-.69 0L8 14.25z"
								/>
							</svg>
							<span>Sponsor</span>
						</a>
					</div>
				</div>

				<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="margin: auto; display: block; shape-rendering: auto; position: absolute; right: 0; bottom: 0;" width="200px" height="100px" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid">
					<g transform="translate(20 50)">
						<circle cx="0" cy="0" r="6" fill="#41b883">
							<animateTransform attributeName="transform" type="scale" begin="-0.375s" calcMode="spline" keySplines="0.3 0 0.7 1;0.3 0 0.7 1" values="0;1;0" keyTimes="0;0.5;1" dur="1s" repeatCount="indefinite"></animateTransform>
						</circle>
					</g>
					<g transform="translate(40 50)">
						<circle cx="0" cy="0" r="6" fill="#34495e">
							<animateTransform attributeName="transform" type="scale" begin="-0.25s" calcMode="spline" keySplines="0.3 0 0.7 1;0.3 0 0.7 1" values="0;1;0" keyTimes="0;0.5;1" dur="1s" repeatCount="indefinite"></animateTransform>
						</circle>
					</g>
					<g transform="translate(60 50)">
						<circle cx="0" cy="0" r="6" fill="#34495e">
							<animateTransform attributeName="transform" type="scale" begin="-0.125s" calcMode="spline" keySplines="0.3 0 0.7 1;0.3 0 0.7 1" values="0;1;0" keyTimes="0;0.5;1" dur="1s" repeatCount="indefinite"></animateTransform>
						</circle>
					</g>
					<g transform="translate(80 50)">
						<circle cx="0" cy="0" r="6" fill="#41b883">
							<animateTransform attributeName="transform" type="scale" begin="0s" calcMode="spline" keySplines="0.3 0 0.7 1;0.3 0 0.7 1" values="0;1;0" keyTimes="0;0.5;1" dur="1s" repeatCount="indefinite"></animateTransform>
						</circle>
					</g>
				</svg>
			</div>
		`;

		return html;
	}
}
