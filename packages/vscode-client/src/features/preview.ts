import * as vscode from 'vscode';
import { parse } from '@vue/compiler-sfc';

let defaultServerUrl = 'http://localhost:3000/';
let panel: vscode.WebviewPanel | undefined;

export async function activate(context: vscode.ExtensionContext) {

    context.subscriptions.push(vscode.commands.registerCommand('volar.action.selectElement', () => {
        panel?.webview.postMessage({ sender: 'volar', command: 'selectElement' });
    }));

    context.subscriptions.push(vscode.commands.registerCommand('volar.action.preview', async () => {

        const serverUrl = await createInputBox(defaultServerUrl, 'Preview Server URL...');
        if (!serverUrl) return;

        defaultServerUrl = serverUrl;
        panel = vscode.window.createWebviewPanel(
            'preview',
            'Preview',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
            },
        );

        updatePanel(panel);
        update(serverUrl);
    }));

    context.subscriptions.push(vscode.window.registerWebviewPanelSerializer('preview', new PreviewSerializer()));
}

class PreviewSerializer implements vscode.WebviewPanelSerializer {
    async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: { url: string }) {
        updatePanel(webviewPanel);
        update(state.url);
    }
}

function updatePanel(_panel: vscode.WebviewPanel) {
    // const changeDisposable = vscode.window.onDidChangeActiveTextEditor(update);
    const messageDisposable = _panel.webview.onDidReceiveMessage(async message => {
        switch (message.command) {
            case 'log': {
                const text = message.data;
                vscode.window.showInformationMessage(text);
                break;
            }
            case 'goToTemplate': {
                const data = message.data as {
                    fileName: string,
                    range: [number, number],
                };
                const doc = await vscode.workspace.openTextDocument(data.fileName);
                const sfc = parse(doc.getText());
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
    });

    _panel.onDidDispose(() => {
        // changeDisposable.dispose();
        messageDisposable.dispose();
    });

    panel = _panel;
}
function update(serverUrl: string) {
    if (!panel) return;

    // const editor = vscode.window.activeTextEditor;
    // if (!editor) return;

    // const document = editor.document;
    // if (document.languageId !== 'vue') return;

    // panel.title = 'Preview ' + path.basename(document.fileName);
    panel.title = 'Volar WebView';
    panel.webview.html = getWebviewContent(serverUrl);
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
function getWebviewContent(url: string) {
    return `
<style>
body {
    padding: 0;
    background-color: #fff;
}
</style>
<script>
const vscode = acquireVsCodeApi();
vscode.setState({ url: '${url}' });
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
