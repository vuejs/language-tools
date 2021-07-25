import * as vscode from 'vscode';
import { parse } from '@vue/compiler-sfc';
import * as path from 'path';
import { sleep } from '@volar/shared';
import * as portfinder from 'portfinder';

let finderPanel: vscode.WebviewPanel | undefined;
let previewPanel: vscode.WebviewPanel | undefined;
let lastPreviewFile: string | undefined;
let lastPreviewQuery: string | undefined;

const previewPort = 3333;

export async function activate(context: vscode.ExtensionContext) {

	class FinderPanelSerializer implements vscode.WebviewPanelSerializer {
		async deserializeWebviewPanel(panel: vscode.WebviewPanel) {
			const port = await startFinderPanel(panel);
			panel.webview.html = getWebviewContent(`http://localhost:${port}`)
		}
	}

	class PreviewPanelSerializer implements vscode.WebviewPanelSerializer {
		async deserializeWebviewPanel(panel: vscode.WebviewPanel, state: { fileName: string, query: string }) {
			const port = await startPreviewPanel(panel);
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

		finderPanel = vscode.window.createWebviewPanel(
			'finder',
			'Code Finder',
			vscode.ViewColumn.Beside,
			{
				enableScripts: true,
			},
		);

		const port = await startFinderPanel(finderPanel);
		finderPanel.webview.html = getWebviewContent(`http://localhost:${port}`);
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

		const port = await startPreviewPanel(previewPanel);
		updatePreviewPanel(editor.document.fileName, createQuery(editor.document.getText()), port);
	}));

	context.subscriptions.push(vscode.window.registerWebviewPanelSerializer('finder', new FinderPanelSerializer()));
	context.subscriptions.push(vscode.window.registerWebviewPanelSerializer('preview', new PreviewPanelSerializer()));

	async function startFinderPanel(_panel: vscode.WebviewPanel) {

		vscode.commands.executeCommand('setContext', 'volar.showSelectElement', true);
		const messageDisposable = _panel.webview.onDidReceiveMessage(webViewEventHandler);

		_panel.onDidDispose(() => {
			vscode.commands.executeCommand('setContext', 'volar.showSelectElement', false);
			messageDisposable.dispose();
			terminal.dispose();
		});

		const port = await portfinder.getPortPromise({ port: previewPort });
		const terminal = vscode.window.createTerminal('volar-finder');
		terminal.sendText(`npx vite --port=${port} --mode=volar`);

		const start = Date.now();
		while (Date.now() - start < 10000 && await portfinder.getPortPromise({ port: port }) === port) {
			await sleep(10);
		}

		finderPanel = _panel;

		return port;
	}

	async function startPreviewPanel(_panel: vscode.WebviewPanel) {

		const disposable_1 = vscode.window.onDidChangeActiveTextEditor(e => {
			if (e && e.document.languageId === 'vue') {
				updatePreviewPanel(e.document.fileName, createQuery(e.document.getText()), port);
			}
		});
		const disposable_2 = vscode.workspace.onDidChangeTextDocument(e => {
			if (e.document.fileName === lastPreviewFile) {
				const newQuery = createQuery(e.document.getText());
				if (newQuery !== lastPreviewQuery) {
					updatePreviewPanel(e.document.fileName, newQuery, port);
				}
			}
		});
		const disposable_3 = _panel.webview.onDidReceiveMessage(webViewEventHandler);

		_panel.onDidDispose(() => {
			disposable_1.dispose();
			disposable_2.dispose();
			disposable_3.dispose();
			terminal.dispose();
		});

		const port = await portfinder.getPortPromise({ port: previewPort });
		const terminal = vscode.window.createTerminal('volar-previewer');
		terminal.sendText(`npx vite --port=${port}`);

		const start = Date.now();
		while (Date.now() - start < 10000 && await portfinder.getPortPromise({ port: port }) === port) {
			await sleep(10);
		}

		previewPanel = _panel;

		return port;
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
				const keys = Object.keys(customBlock.attrs);
				for (let i = 0; i < keys.length; i++) {
					query += i === 0 ? '?' : '&';
					const key = keys[i];
					const value = customBlock.attrs[key];
					query += key;
					query += '=';
					query += encodeURIComponent(JSON.stringify(value));
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

	function getWebviewContent(url: string, state: any = {}, bg?: string) {
		return `
			<style>
			body {
				padding: 0;
				${bg ? `background-image: url(${bg});` : 'background-color: #fff;'}
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
