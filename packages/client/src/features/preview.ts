import * as vscode from 'vscode';
import * as path from 'upath';

export async function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('volar.action.preview', async () => {

        let defaultServerUrl = 'http://localhost:3000/preview#';
        const serverUrl = vscode.window.createInputBox();
        serverUrl.placeholder = 'Preview Server URL...';
        serverUrl.value = defaultServerUrl;
        serverUrl.onDidAccept(() => {
            defaultServerUrl = serverUrl.value;
            const panel = vscode.window.createWebviewPanel(
                'vuePreview',
                'Preview',
                vscode.ViewColumn.Beside,
                { enableScripts: true },
            );

            const changeDisposable = vscode.window.onDidChangeActiveTextEditor(update);
            panel.onDidDispose(() => changeDisposable.dispose());

            update();

            function update() {
                const editor = vscode.window.activeTextEditor;
                if (!editor) return;

                const document = editor.document;
                if (document.languageId !== 'vue') return;

                panel.title = 'Preview ' + path.basename(document.fileName);
                panel.webview.html = `<iframe src="${serverUrl.value}${document.uri.fsPath}" frameborder="0" style="display: block; margin: 0px; overflow: hidden; width: 100%; height: 100vh;" />`;
            }
            panel.webview.onDidReceiveMessage(e => console.log(e))
        });
        serverUrl.show();
    }));
}
