import * as vscode from 'vscode';
import { parse } from '@vue/compiler-sfc';
import * as path from 'path';
import { sleep } from '@volar/shared';
import * as portfinder from 'portfinder';

let defaultServerUrl = 'http://localhost:3000/';
let finderPanel: vscode.WebviewPanel | undefined;
let previewPanel: vscode.WebviewPanel | undefined;
let lastPreviewFile: string | undefined;
let lastPreviewQuery: string | undefined;

const previewPort = 3333;

export async function activate(context: vscode.ExtensionContext) {

	class FinderPanelSerializer implements vscode.WebviewPanelSerializer {
		async deserializeWebviewPanel(panel: vscode.WebviewPanel, state: { title: string, url: string }) {
			startFinderPanel(panel);
			updateFinderPanel(panel, state.title, state.url);
		}
	}

	class PreviewPanelSerializer implements vscode.WebviewPanelSerializer {
		async deserializeWebviewPanel(panel: vscode.WebviewPanel, state: { fileName: string, query: string }) {
			const port = await portfinder.getPortPromise({ port: previewPort });
			await startPreviewPanel(panel, port);
			updatePreviewPanel(state.fileName, state.query, port);
		}
	}

	// kill preview terminals on reload vscode
	for (const terminal of vscode.window.terminals) {
		if (terminal.name === 'volar-preview') {
			terminal.dispose();
		}
	}

	context.subscriptions.push(vscode.commands.registerCommand('volar.action.selectElement', () => {
		finderPanel?.webview.postMessage({ sender: 'volar', command: 'selectElement' });
	}));

	context.subscriptions.push(vscode.commands.registerCommand('volar.action.finder', async () => {

		const serverUrl = await createInputBox(defaultServerUrl, 'Preview Server URL...');
		if (!serverUrl) return;

		defaultServerUrl = serverUrl;
		finderPanel = vscode.window.createWebviewPanel(
			'finder',
			'Volar WebView',
			vscode.ViewColumn.Beside,
			{
				enableScripts: true,
			},
		);

		startFinderPanel(finderPanel);
		updateFinderPanel(finderPanel, 'Volar WebView', serverUrl);
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

		const port = await portfinder.getPortPromise({ port: previewPort });
		await startPreviewPanel(previewPanel, port);
		updatePreviewPanel(editor.document.fileName, createQuery(editor.document.getText()), port);
	}));

	context.subscriptions.push(vscode.window.registerWebviewPanelSerializer('finder', new FinderPanelSerializer()));
	context.subscriptions.push(vscode.window.registerWebviewPanelSerializer('preview', new PreviewPanelSerializer()));

	function startFinderPanel(_panel: vscode.WebviewPanel) {
		vscode.commands.executeCommand('setContext', 'volar.showSelectElement', true);
		const messageDisposable = _panel.webview.onDidReceiveMessage(webViewEventHandler);

		_panel.onDidDispose(() => {
			vscode.commands.executeCommand('setContext', 'volar.showSelectElement', false);
			messageDisposable.dispose();
		});

		finderPanel = _panel;
	}

	async function startPreviewPanel(_panel: vscode.WebviewPanel, port: number) {

		const terminal = vscode.window.createTerminal('volar-preview');
		terminal.sendText(`npx vite --port=${port}`);

		while (await portfinder.getPortPromise({ port: port }) === port) {
			await sleep(10);
		}

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

		previewPanel = _panel;
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

	function updateFinderPanel(panel: vscode.WebviewPanel, title: string, src: string) {
		panel.title = title;
		panel.webview.html = getWebviewContent(src, { title, src });
	}

	function createInputBox(defaultValue: string, placeholder: string) {
		return new Promise<string | undefined>(resolve => {
			const serverUrl = vscode.window.createInputBox();
			serverUrl.placeholder = placeholder;
			serverUrl.value = defaultValue;
			serverUrl.onDidAccept(() => resolve(serverUrl.value));
			serverUrl.onDidHide(() => resolve(undefined))
			serverUrl.show();
		});
	}

	function getWebviewContent(url: string, state: any, bg?: string) {
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
