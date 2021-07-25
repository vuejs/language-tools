import * as vscode from 'vscode';
import { parse } from '@vue/compiler-sfc';
import { compile, NodeTypes } from '@vue/compiler-dom';
import * as path from 'path';
import * as fs from 'fs';
import { sleep } from '@volar/shared';
import * as portfinder from 'portfinder';

let finderPanel: vscode.WebviewPanel | undefined;
let previewPanel: vscode.WebviewPanel | undefined;
let lastPreviewFile: string | undefined;
let lastPreviewQuery: string | undefined;

export async function activate(context: vscode.ExtensionContext) {

	class FinderPanelSerializer implements vscode.WebviewPanelSerializer {
		async deserializeWebviewPanel(panel: vscode.WebviewPanel, state: { fileName: string }) {
			const port = await startFinderPanel(panel, state.fileName);
			panel.webview.html = getWebviewContent(`http://localhost:${port}`, state)
		}
	}

	class PreviewPanelSerializer implements vscode.WebviewPanelSerializer {
		async deserializeWebviewPanel(panel: vscode.WebviewPanel, state: { fileName: string, query: string }) {
			const port = await startPreviewPanel(panel, state.fileName);
			updatePreviewPanel(state.fileName, state.query, port);
		}
	}

	// kill preview terminals on reload vscode
	for (const terminal of vscode.window.terminals) {
		if (terminal.name === 'volar-previewer' || terminal.name === 'volar-finder') {
			terminal.dispose();
		}
	}

	context.subscriptions.push(vscode.commands.registerCommand('volar.action.selectElement', () => {
		finderPanel?.webview.postMessage({ sender: 'volar', command: 'selectElement' });
	}));

	context.subscriptions.push(vscode.commands.registerCommand('volar.action.finder', async () => {

		const editor = vscode.window.activeTextEditor;
		if (!editor)
			return;

		const document = editor.document;
		if (document.languageId !== 'vue')
			return;

		finderPanel = vscode.window.createWebviewPanel(
			'finder',
			'Code Finder',
			vscode.ViewColumn.Beside,
			{
				enableScripts: true,
			},
		);

		const port = await startFinderPanel(finderPanel, document.fileName);
		finderPanel.webview.html = getWebviewContent(`http://localhost:${port}`, { fileName: document.fileName });
	}));

	context.subscriptions.push(vscode.commands.registerCommand('volar.action.preview', async () => {

		const editor = vscode.window.activeTextEditor;
		if (!editor)
			return;

		const document = editor.document;
		if (document.languageId !== 'vue')
			return;

		previewPanel = vscode.window.createWebviewPanel(
			'preview',
			'Preview',
			vscode.ViewColumn.Beside,
			{
				enableScripts: true,
			},
		);

		const port = await startPreviewPanel(previewPanel, document.fileName);
		updatePreviewPanel(editor.document.fileName, createQuery(editor.document.getText()), port);
	}));

	context.subscriptions.push(vscode.window.registerWebviewPanelSerializer('finder', new FinderPanelSerializer()));
	context.subscriptions.push(vscode.window.registerWebviewPanelSerializer('preview', new PreviewPanelSerializer()));

	async function startFinderPanel(_panel: vscode.WebviewPanel, fileName: string) {

		vscode.commands.executeCommand('setContext', 'volar.showSelectElement', true);
		const disposable_1 = _panel.webview.onDidReceiveMessage(webViewEventHandler);
		const disposable_2 = vscode.workspace.onDidChangeConfiguration(() => {
			_panel.webview.html = getWebviewContent(`http://localhost:${port}`, { fileName });
		});

		_panel.onDidDispose(() => {
			vscode.commands.executeCommand('setContext', 'volar.showSelectElement', false);
			disposable_1.dispose();
			disposable_2.dispose();
			terminal.dispose();
		});

		const port = await portfinder.getPortPromise({ port: vscode.workspace.getConfiguration('volar').get('preview.port') ?? 3333 });
		const terminal = vscode.window.createTerminal('volar-finder');
		const viteDir = getViteDir(fileName);
		if (viteDir) {
			terminal.sendText(`cd ${viteDir}`);
		}
		terminal.sendText(`npx vite --port=${port} --mode=volar`);

		const start = Date.now();
		while (Date.now() - start < 10000 && await portfinder.getPortPromise({ port: port }) === port) {
			await sleep(10);
		}

		finderPanel = _panel;

		return port;
	}

	async function startPreviewPanel(_panel: vscode.WebviewPanel, fileName: string) {

		const disposable_1 = vscode.window.onDidChangeActiveTextEditor(async e => {
			// if (e && e.document.languageId === 'vue' && e.document.fileName !== lastPreviewFile) {
			// 	_panel.dispose();
			// 	vscode.commands.executeCommand('volar.action.preview');

			// 	// TODO: not working
			// 	// const newQuery = createQuery(e.document.getText());
			// 	// const url = `http://localhost:${port}/__preview${newQuery}#${e.document.fileName}`;
			// 	// previewPanel?.webview.postMessage({ sender: 'volar', command: 'updateUrl', data: url });

			// 	// lastPreviewFile = e.document.fileName;
			// 	// lastPreviewQuery = newQuery;
			// }
		});
		const disposable_2 = vscode.workspace.onDidChangeTextDocument(e => {
			if (e.document.fileName === lastPreviewFile) {
				const newQuery = createQuery(e.document.getText());
				if (newQuery !== lastPreviewQuery) {
					const url = `http://localhost:${port}/__preview${newQuery}#${lastPreviewFile}`;
					previewPanel?.webview.postMessage({ sender: 'volar', command: 'updateUrl', data: url });

					lastPreviewQuery = newQuery;
				}
			}
		});
		const disposable_3 = _panel.webview.onDidReceiveMessage(webViewEventHandler);
		const disposable_4 = vscode.workspace.onDidChangeConfiguration(() => {
			if (lastPreviewFile !== undefined && lastPreviewQuery !== undefined) {
				updatePreviewPanel(lastPreviewFile, lastPreviewQuery, port);
			}
		});

		_panel.onDidDispose(() => {
			disposable_1.dispose();
			disposable_2.dispose();
			disposable_3.dispose();
			disposable_4.dispose();
			terminal.dispose();
		});

		const port = await portfinder.getPortPromise({ port: vscode.workspace.getConfiguration('volar').get('preview.port') ?? 3333 });
		const terminal = vscode.window.createTerminal('volar-previewer');
		const viteDir = getViteDir(fileName);
		if (viteDir) {
			terminal.sendText(`cd ${viteDir}`);
		}
		terminal.sendText(`npx vite --port=${port}`);

		const start = Date.now();
		while (Date.now() - start < 10000 && await portfinder.getPortPromise({ port: port }) === port) {
			await sleep(10);
		}

		previewPanel = _panel;

		return port;
	}

	function getViteDir(fileName: string) {
		let dir = path.dirname(fileName);
		let viteConfigDir: string | undefined;
		while (true) {
			const configTs = path.join(dir, 'vite.config.ts');
			const configJs = path.join(dir, 'vite.config.js');
			if (fs.existsSync(configTs) || fs.existsSync(configJs)) {
				viteConfigDir = dir;
				break;
			}
			const upperDir = path.dirname(dir);
			if (upperDir === dir) {
				break;
			}
			dir = upperDir;
		}
		return viteConfigDir;
	}

	async function webViewEventHandler(message: any) {
		switch (message.command) {
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
				const data = message.data as {
					fileName: string,
					range: [number, number],
				};
				const doc = await vscode.workspace.openTextDocument(data.fileName);
				const sfc = parse(doc.getText(), { sourceMap: false, ignoreEmpty: false });
				const offset = sfc.descriptor.template?.loc.start.offset ?? 0;
				const start = doc.positionAt(data.range[0] + offset);
				const end = doc.positionAt(data.range[1] + offset);
				await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
				const editor = vscode.window.activeTextEditor;
				if (editor) {
					editor.selection = new vscode.Selection(start, end);
					editor.revealRange(new vscode.Range(start, end));
				}
				break;
			}
		}
	}

	function createQuery(vueCode: string) {
		let query = '';
		const sfc = parse(vueCode, { sourceMap: false, ignoreEmpty: false });
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
				break;
			}
		}
		return query;
	}

	function updatePreviewPanel(fileName: string, query: string, port: number) {
		if (previewPanel) {
			const bgPath = vscode.Uri.file(path.join(context.extensionPath, 'images', 'preview-bg.png'));
			const bgSrc = previewPanel.webview.asWebviewUri(bgPath);
			const url = `http://localhost:${port}/__preview${query}#${fileName}`;
			previewPanel.title = 'Preview ' + path.basename(fileName);
			previewPanel.webview.html = getWebviewContent(url, { fileName, query }, bgSrc.toString());
			lastPreviewFile = fileName;
			lastPreviewQuery = query;
		}
	}

	function getWebviewContent(url: string, state: any, bg?: string) {
		const configs = vscode.workspace.getConfiguration('volar');
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

			<iframe id="preview" src="${url}" frameborder="0" style="display: block; margin: 0px; overflow: hidden; width: 100%; height: 100vh;" />
		`;
	}
}
