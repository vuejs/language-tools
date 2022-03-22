import * as vscode from 'vscode';
import { compile, NodeTypes } from '@vue/compiler-dom';
import * as path from 'path';
import * as fs from '../utils/fs';
import * as shared from '@volar/shared';
import { userPick } from './splitEditors';
import { parse } from '@vue/compiler-sfc';

interface PreviewState {
	mode: 'vite' | 'nuxt',
	port: number,
	fileName: string,
}

const enum PreviewType {
	Webview = 'volar-webview',
	ComponentPreview = 'volar-component-preview',
}

export async function activate(context: vscode.ExtensionContext) {

	let goToTemplateReq = 0;

	class FinderPanelSerializer implements vscode.WebviewPanelSerializer {
		async deserializeWebviewPanel(panel: vscode.WebviewPanel, state: PreviewState) {

			const terminal = vscode.window.terminals.find(terminal => terminal.name === 'volar-preview');
			const port = await openPreview(PreviewType.Webview, state.fileName, '', state.mode, terminal, state.port, panel);

			panel.webview.html = getWebviewContent(`http://localhost:${port}`, state)
		}
	}

	class PreviewPanelSerializer implements vscode.WebviewPanelSerializer {
		async deserializeWebviewPanel(panel: vscode.WebviewPanel, state: PreviewState) {

			const editor = vscode.window.visibleTextEditors.find(document => document.document.fileName === state.fileName);
			if (!editor) return;

			const terminal = vscode.window.terminals.find(terminal => terminal.name === 'volar-preview');
			const port = await openPreview(PreviewType.ComponentPreview, editor.document.fileName, editor.document.getText(), state.mode, terminal, state.port, panel);

			if (port !== undefined) {
				const previewQuery = createQuery(editor.document.fileName, editor.document.getText());
				updatePreviewPanel(panel, state.fileName, previewQuery, port, state.mode);
			}
		}
	}

	context.subscriptions.push(vscode.commands.registerCommand('volar.action.vite', async () => {

		const editor = vscode.window.activeTextEditor;
		if (!editor)
			return;

		const viteConfigFile = await getConfigFile(editor.document.fileName, 'vite');
		const select = await userPick({
			[PreviewType.Webview]: { label: 'Preview Vite App', detail: vscode.workspace.rootPath && viteConfigFile ? path.relative(vscode.workspace.rootPath, viteConfigFile) : viteConfigFile },
			[PreviewType.ComponentPreview]: { label: `Preview Component with Vite`, description: '(WIP)', detail: vscode.workspace.rootPath ? path.relative(vscode.workspace.rootPath, editor.document.fileName) : editor.document.fileName },
		});
		if (select === undefined)
			return; // cancle

		openPreview(select as PreviewType, editor.document.fileName, editor.document.getText(), 'vite');
	}));
	context.subscriptions.push(vscode.commands.registerCommand('volar.action.nuxt', async () => {

		const editor = vscode.window.activeTextEditor;
		if (!editor)
			return;

		const viteConfigFile = await getConfigFile(editor.document.fileName, 'nuxt');
		const select = await userPick({
			[PreviewType.Webview]: { label: 'Preview Nuxt App', detail: vscode.workspace.rootPath && viteConfigFile ? path.relative(vscode.workspace.rootPath, viteConfigFile) : viteConfigFile },
		});
		if (select === undefined)
			return; // cancle

		openPreview(select as PreviewType, editor.document.fileName, editor.document.getText(), 'nuxt');
	}));

	context.subscriptions.push(vscode.window.registerWebviewPanelSerializer(PreviewType.Webview, new FinderPanelSerializer()));
	context.subscriptions.push(vscode.window.registerWebviewPanelSerializer(PreviewType.ComponentPreview, new PreviewPanelSerializer()));
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateFoundViteDir));

	updateFoundViteDir();

	async function updateFoundViteDir() {
		if (vscode.window.activeTextEditor?.document.languageId === 'vue') {

			const viteConfigFile = await getConfigFile(vscode.window.activeTextEditor.document.fileName, 'vite');
			const nuxtConfigFile = await getConfigFile(vscode.window.activeTextEditor.document.fileName, 'nuxt');

			vscode.commands.executeCommand('setContext', 'volar.foundViteDir', viteConfigFile !== undefined);
			vscode.commands.executeCommand('setContext', 'volar.foundNuxtDir', nuxtConfigFile !== undefined);
		}
	}
	async function openPreview(previewType: PreviewType, fileName: string, fileText: string, mode: 'vite' | 'nuxt', _terminal?: vscode.Terminal, _port?: number, _panel?: vscode.WebviewPanel) {

		const configFile = await getConfigFile(fileName, mode);
		if (!configFile)
			return;

		const configDir = path.dirname(configFile);
		const { terminal, port } = _terminal && _port
			? { terminal: _terminal, port: _port }
			: await startServerServer(configDir, mode);

		const panel = _panel ?? vscode.window.createWebviewPanel(
			previewType,
			'Volar Webview',
			vscode.ViewColumn.Beside,
			{
				retainContextWhenHidden: true,
				enableScripts: true,
			},
		);
		const panelContext: vscode.Disposable[] = [];

		panel.onDidDispose(() => {
			for (const disposable of panelContext) {
				disposable.dispose();
			}
		});

		const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
		statusBar.command = 'volar.inputWebviewUrl';
		statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
		panelContext.push(statusBar);

		panelContext.push(terminal);
		panelContext.push(vscode.commands.registerCommand('volar.action.selectElement', () => {
			panel.webview.postMessage({ sender: 'volar', command: 'selectElement' });
		}));
		panelContext.push(vscode.commands.registerCommand('volar.action.openInBrowser', () => {
			vscode.env.openExternal(vscode.Uri.parse(statusBar.text));
		}));

		if (previewType === PreviewType.Webview) {

			panelContext.push(panel.webview.onDidReceiveMessage(webviewEventHandler));
			panelContext.push(vscode.workspace.onDidChangeConfiguration(() => {
				panel.webview.html = getWebviewContent(`http://localhost:${port}`, { port, fileName, mode });
			}));
			panelContext.push(vscode.commands.registerCommand('volar.inputWebviewUrl', async () => {
				const input = await vscode.window.showInputBox({ value: statusBar.text });
				if (input !== undefined && input !== statusBar.text) {
					panel.webview.html = getWebviewContent(input, { port, fileName, mode });
				}
			}));

			panel.webview.html = getWebviewContent(`http://localhost:${port}`, { port, fileName, mode });

			panel.onDidChangeViewState(() => {
				if (panel.active)
					statusBar.show();
				else
					statusBar.hide();
			});
		}
		else if (previewType === PreviewType.ComponentPreview) {

			// const disposable_1 = vscode.window.onDidChangeActiveTextEditor(async e => {
			// 	if (e && e.document.languageId === 'vue' && e.document.fileName !== lastPreviewFile) {
			// 		_panel.dispose();
			// 		vscode.commands.executeCommand('volar.action.preview');

			// 		// TODO: not working
			// 		// const newQuery = createQuery(e.document.getText());
			// 		// const url = `http://localhost:${port}/__preview${newQuery}#${e.document.fileName}`;
			// 		// previewPanel?.webview.postMessage({ sender: 'volar', command: 'updateUrl', data: url });

			// 		// lastPreviewFile = e.document.fileName;
			// 		// lastPreviewQuery = newQuery;
			// 	}
			// });
			let previewQuery = createQuery(fileText, fileName);

			panelContext.push(vscode.workspace.onDidChangeTextDocument(e => {
				if (e.document.fileName === fileName) {
					const newPreviewQuery = createQuery(e.document.getText(), e.document.fileName);
					if (newPreviewQuery !== previewQuery) {
						const url = `http://localhost:${port}/__preview${newPreviewQuery}#${e.document.fileName}`;
						panel.webview.postMessage({ sender: 'volar', command: 'updateUrl', data: url });

						previewQuery = newPreviewQuery;
					}
				}
			}));
			panelContext.push(panel.webview.onDidReceiveMessage(webviewEventHandler));
			panelContext.push(vscode.workspace.onDidChangeConfiguration(() => {
				updatePreviewPanel(panel, fileName, previewQuery, port, mode);
			}));

			updatePreviewPanel(panel, fileName, previewQuery, port, mode);
		}

		return port;

		async function webviewEventHandler(message: any) {
			switch (message.command) {
				case 'openUrl': {
					const url = message.data;
					vscode.env.openExternal(vscode.Uri.parse(url));
					break;
				}
				case 'urlChanged': {
					const url = message.data;
					statusBar.text = url;
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
				case 'goToTemplate': {
					const req = ++goToTemplateReq;
					const data = message.data as {
						fileName: string,
						range: [number, number],
					};
					const doc = await vscode.workspace.openTextDocument(data.fileName);

					if (req !== goToTemplateReq)
						return;

					const sfc = parse(doc.getText(), { sourceMap: false, ignoreEmpty: false });
					const offset = sfc.descriptor.template?.loc.start.offset ?? 0;
					const start = doc.positionAt(data.range[0] + offset);
					const end = doc.positionAt(data.range[1] + offset);
					await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);

					if (req !== goToTemplateReq)
						return;

					const editor = vscode.window.activeTextEditor;
					if (editor) {
						editor.selection = new vscode.Selection(start, end);
						editor.revealRange(new vscode.Range(start, end));
					}
					break;
				}
			}
		}
	}

	async function startServerServer(viteDir: string, type: 'vite' | 'nuxt') {

		const port = await shared.getLocalHostAvaliablePort(vscode.workspace.getConfiguration('volar').get('preview.port') ?? 3333);
		const terminal = vscode.window.createTerminal('volar-preview');
		const viteProxyPath = type === 'vite'
			? require.resolve('./bin/vite', { paths: [context.extensionPath] })
			: require.resolve('./bin/nuxi', { paths: [context.extensionPath] });

		terminal.sendText(`cd ${viteDir}`);

		if (type === 'vite')
			terminal.sendText(`node ${JSON.stringify(viteProxyPath)} --port=${port}`);
		else
			terminal.sendText(`node ${JSON.stringify(viteProxyPath)} dev --port ${port}`);

		return {
			port,
			terminal,
		};
	}

	async function getConfigFile(fileName: string, mode: 'vite' | 'nuxt') {
		let dir = path.dirname(fileName);
		let configFile: string | undefined;
		while (true) {
			const configTs = path.join(dir, mode + '.config.ts');
			const configJs = path.join(dir, mode + '.config.js');
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

	function createQuery(vueCode: string, fileName: string) {

		const sfc = parse(vueCode, { sourceMap: false, ignoreEmpty: false });
		let query = '';

		for (const customBlock of sfc.descriptor.customBlocks) {
			if (customBlock.type === 'preview') {
				const previewTagStart = vueCode.substring(0, customBlock.loc.start.offset).lastIndexOf('<preview');
				const previewTag = vueCode.substring(previewTagStart, customBlock.loc.start.offset);
				const previewGen = compile(previewTag + '</preview>').ast;
				const props: Record<string, string> = {};
				for (const previewNode of previewGen.children) {
					if (previewNode.type === NodeTypes.ELEMENT) {
						for (const prop of previewNode.props) {
							if (prop.type === NodeTypes.ATTRIBUTE) {
								if (prop.value) {
									props[prop.name] = JSON.stringify(prop.value.content);
								}
								else {
									props[prop.name] = JSON.stringify(true);
								}
							}
							else if (prop.type === NodeTypes.DIRECTIVE) {
								if (prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION && prop.exp?.type == NodeTypes.SIMPLE_EXPRESSION) {
									props[prop.arg.content] = prop.exp.content;
								}
							}
						}
					}
				}
				const keys = Object.keys(props);
				for (let i = 0; i < keys.length; i++) {
					query += i === 0 ? '?' : '&';
					const key = keys[i];
					const value = props[key];
					query += key;
					query += '=';
					query += encodeURIComponent(value);
				}
			}
			else if (customBlock.type === 'preview-target' && typeof customBlock.attrs.path === 'string') {
				fileName = path.resolve(path.dirname(fileName), customBlock.attrs.path);
			}
		}

		return query;
	}

	function updatePreviewPanel(previewPanel: vscode.WebviewPanel, fileName: string, query: string, port: number, mode: 'vite' | 'nuxt') {
		const bgPath = vscode.Uri.file(path.join(context.extensionPath, 'images', 'preview-bg.png'));
		const bgSrc = previewPanel.webview.asWebviewUri(bgPath);
		const url = `http://localhost:${port}/__preview${query}#${fileName}`;
		previewPanel.title = 'Preview ' + path.basename(fileName);
		previewPanel.webview.html = getWebviewContent(url, { port, fileName, mode }, bgSrc.toString());
	}

	function getWebviewContent(url: string, state: PreviewState, bg?: string) {
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
			${state ? `vscode.setState(${JSON.stringify(state)});` : ''}

			let preview;

			window.addEventListener('message', e => {
				if (e.data.sender === 'volar') {
					preview.contentWindow.postMessage(e.data, '*');
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

				console.log('server started');

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

			function onClickSvg() {
				vscode.postMessage({ command: 'openUrl', data: 'https://cdn.jsdelivr.net/gh/johnsoncodehk/sponsors/sponsors.svg' });
			}
			function previewFrameLoaded() {
				console.log('myframe is loaded', Date.now() - start);
				preview.style.height = '100vh';
				document.getElementById('loading').remove();
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
				<p align="center">
					<a href="#" onclick="onClickSvg()">
						<img src="https://cdn.jsdelivr.net/gh/johnsoncodehk/sponsors/sponsors.svg?time=${Math.round(Date.now() / 1000 / 3600)}" />
					</a>
				</p>

				<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="margin: auto; display: block; shape-rendering: auto;" width="200px" height="100px" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid">
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
