/**
 * This project is open source, so I can't stop you from hacking the client code to use experimental features.
 * If you decide to do this, please don't share it, sponsorships are the only income for this project.
 * If income gets interrupted, the project may have to be stop open source or even stopped to maintenance.
 * 
 * 这个项目是开源的，因此我无法阻止你破解客户端代码以使用实验性功能。
 * 如果你决定这样做，请不要對外分享。
 * 赞助是这个项目唯一的收入，如果被中断，这个项目可能不得不改为闭源， 甚至停止维护。
 */

import * as vscode from 'vscode';
import { compile, NodeTypes } from '@vue/compiler-dom';
import * as path from 'upath';
import * as fs from '../utils/fs';
import * as shared from '@volar/shared';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { htmlLs, userPick } from './splitEditors';

interface PreviewState { port: number, fileName: string }

const enum PreviewType {
	Webview = 'volar-webview',
	ComponentPreview = 'volar-component-preview',
}

export async function activate(context: vscode.ExtensionContext) {

	let goToTemplateReq = 0;

	class FinderPanelSerializer implements vscode.WebviewPanelSerializer {
		async deserializeWebviewPanel(panel: vscode.WebviewPanel, state: PreviewState) {

			const terminal = vscode.window.terminals.find(terminal => terminal.name === 'volar-preview');
			const port = await openPreview(PreviewType.Webview, state.fileName, '', terminal, state.port, panel);

			panel.webview.html = getWebviewContent(`http://localhost:${port}`, state)
		}
	}

	class PreviewPanelSerializer implements vscode.WebviewPanelSerializer {
		async deserializeWebviewPanel(panel: vscode.WebviewPanel, state: PreviewState) {

			const editor = vscode.window.visibleTextEditors.find(document => document.document.fileName === state.fileName);
			if (!editor) return;

			const terminal = vscode.window.terminals.find(terminal => terminal.name === 'volar-preview');
			const port = await openPreview(PreviewType.ComponentPreview, editor.document.fileName, editor.document.getText(), terminal, state.port, panel);

			if (port !== undefined) {
				const previewQuery = createQuery(editor.document.fileName, editor.document.getText());
				updatePreviewPanel(panel, state.fileName, previewQuery, port);
			}
		}
	}

	context.subscriptions.push(vscode.commands.registerCommand('volar.action.vite', async () => {

		const editor = vscode.window.activeTextEditor;
		if (!editor)
			return;

		const viteConfigFile = await getViteConfigFile(editor.document.fileName);
		const select = await userPick({
			[PreviewType.Webview]: { label: 'Preview Vite App', description: '(Experimental)', detail: vscode.workspace.rootPath && viteConfigFile ? path.relative(vscode.workspace.rootPath, viteConfigFile) : viteConfigFile },
			[PreviewType.ComponentPreview]: { label: `Preview Component with Vite`, description: '(WIP)', detail: vscode.workspace.rootPath ? path.relative(vscode.workspace.rootPath, editor.document.fileName) : editor.document.fileName },
			// refsGraph: { label: `Refs Reactive Graph (WIP)` },
		});
		if (select === undefined)
			return; // cancle

		openPreview(select as PreviewType, editor.document.fileName, editor.document.getText());
	}));

	context.subscriptions.push(vscode.window.registerWebviewPanelSerializer(PreviewType.Webview, new FinderPanelSerializer()));
	context.subscriptions.push(vscode.window.registerWebviewPanelSerializer(PreviewType.ComponentPreview, new PreviewPanelSerializer()));
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateFoundViteDir));

	updateFoundViteDir();

	async function updateFoundViteDir() {
		if (vscode.window.activeTextEditor?.document.languageId === 'vue') {
			const viteConfigFile = await getViteConfigFile(vscode.window.activeTextEditor.document.fileName);
			vscode.commands.executeCommand('setContext', 'volar.foundViteDir', viteConfigFile !== undefined);
		}
	}
	async function openPreview(mode: PreviewType, fileName: string, fileText: string, _terminal?: vscode.Terminal, _port?: number, _panel?: vscode.WebviewPanel) {

		const viteConfigFile = await getViteConfigFile(fileName);
		if (!viteConfigFile)
			return;

		const viteDir = path.dirname(viteConfigFile);
		const { terminal, port } = _terminal && _port
			? { terminal: _terminal, port: _port }
			: await startViteServer(viteDir);

		const panel = _panel ?? vscode.window.createWebviewPanel(
			mode,
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

		if (mode === PreviewType.Webview) {

			panelContext.push(panel.webview.onDidReceiveMessage(webviewEventHandler));
			panelContext.push(vscode.workspace.onDidChangeConfiguration(() => {
				panel.webview.html = getWebviewContent(`http://localhost:${port}`, { port, fileName });
			}));
			panelContext.push(vscode.commands.registerCommand('volar.inputWebviewUrl', async () => {
				const input = await vscode.window.showInputBox({ value: statusBar.text });
				if (input !== undefined && input !== statusBar.text) {
					panel.webview.html = getWebviewContent(input, { port, fileName });
				}
			}));

			panel.webview.html = getWebviewContent(`http://localhost:${port}`, { port, fileName });

			panel.onDidChangeViewState(() => {
				if (panel.active)
					statusBar.show();
				else
					statusBar.hide();
			});
		}
		else if (mode === PreviewType.ComponentPreview) {

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
				updatePreviewPanel(panel, fileName, previewQuery, port);
			}));

			updatePreviewPanel(panel, fileName, previewQuery, port);
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
				case 'dontShowAgain': {
					vscode.workspace.getConfiguration('volar').update('showWelcomePage', false);
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

					const sfc = shared.parseSfc(doc.getText(), htmlLs.parseHTMLDocument(TextDocument.create(doc.uri.toString(), doc.languageId, doc.version, doc.getText())));
					const offset = sfc.template?.startTagEnd ?? 0;
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

	async function startViteServer(viteDir: string) {

		const port = await shared.getLocalHostAvaliablePort(vscode.workspace.getConfiguration('volar').get('preview.port') ?? 3333);
		const terminal = vscode.window.createTerminal('volar-preview');
		const viteProxyPath = require.resolve('./bin/vite', { paths: [context.extensionPath] });

		terminal.sendText(`cd ${viteDir}`);
		terminal.sendText(`node ${viteProxyPath} --port=${port}`);

		const start = Date.now();
		while (Date.now() - start < 10000 && !(await shared.isLocalHostPortUsing(port))) {
			await shared.sleep(100);
		}

		return {
			port,
			terminal,
		};
	}

	async function getViteConfigFile(fileName: string) {
		let dir = path.dirname(fileName);
		let viteConfigFile: string | undefined;
		while (true) {
			const configTs = path.join(dir, 'vite.config.ts');
			const configJs = path.join(dir, 'vite.config.js');
			if (await fs.exists(vscode.Uri.file(configTs))) {
				viteConfigFile = configTs;
				break;
			}
			if (await fs.exists(vscode.Uri.file(configJs))) {
				viteConfigFile = configJs;
				break;
			}
			const upperDir = path.dirname(dir);
			if (upperDir === dir) {
				break;
			}
			dir = upperDir;
		}
		return viteConfigFile;
	}

	function createQuery(vueCode: string, fileName: string) {

		const sfc = shared.parseSfc(vueCode, htmlLs.parseHTMLDocument(TextDocument.create('', '', 0, vueCode)));
		let query = '';

		for (const customBlock of sfc.customBlocks) {
			if (customBlock.type === 'preview') {
				const previewTagStart = vueCode.substring(0, customBlock.startTagEnd).lastIndexOf('<preview');
				const previewTag = vueCode.substring(previewTagStart, customBlock.startTagEnd);
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
			else if (customBlock.type === 'preview-target' && customBlock.attrs.path) {
				fileName = path.resolve(path.dirname(fileName), customBlock.attrs.path);
			}
		}

		return query;
	}

	function updatePreviewPanel(previewPanel: vscode.WebviewPanel, fileName: string, query: string, port: number) {
		const bgPath = vscode.Uri.file(path.join(context.extensionPath, 'images', 'preview-bg.png'));
		const bgSrc = previewPanel.webview.asWebviewUri(bgPath);
		const url = `http://localhost:${port}/__preview${query}#${fileName}`;
		previewPanel.title = 'Preview ' + path.basename(fileName);
		previewPanel.webview.html = getWebviewContent(url, { port, fileName }, bgSrc.toString());
	}

	function getWebviewContent(url: string, state: PreviewState, bg?: string) {
		const configs = vscode.workspace.getConfiguration('volar');
		const autoBack = !vscode.workspace.getConfiguration('volar').get<boolean>('showWelcomePage');
		return `
			<style>
			body {
				padding: 0;
				background-color: ${configs.get('preview.backgroundColor')};
				${bg && configs.get('preview.transparentGrid') ? `background-image: url(${bg});` : ''}
			}
			</style>

			<script>
			const vscode = acquireVsCodeApi();
			vscode.setState(${JSON.stringify(state)});
			window.addEventListener('message', e => {
				if (e.data.sender === 'volar') {
					document.getElementById('preview').contentWindow.postMessage(e.data, '*');
				}
				else {
					vscode.postMessage(e.data);
				}
			});
			</script>

			<iframe id="preview" src="https://volar-authentication.herokuapp.com/?backUrl=${encodeURIComponent(url)}&autoBack=${autoBack}&lang=${vscode.env.language}" frameborder="0" style="display: block; margin: 0px; overflow: hidden; width: 100%; height: 100vh;" />
		`;
	}
}
