import * as vscode from 'vscode';
import * as path from 'upath';

export async function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('volar.action.preview', async () => {

        let defaultServerUrl = 'http://localhost:3000/preview#';
        let lastEditor: vscode.TextEditor | undefined;

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
            const messageDisposable = panel.webview.onDidReceiveMessage(async message => {
                switch (message.command) {
                    case 'alert':
                        const text = message.data;
                        vscode.window.showInformationMessage(text);
                        return;
                    case 'goToOffset':
                        const offset: number = message.data;
                        if (lastEditor) {
                            const position = lastEditor.document.positionAt(offset);
                            await vscode.window.showTextDocument(lastEditor.document, lastEditor.viewColumn);
                            lastEditor.selection = new vscode.Selection(position, position);
                        }
                        return;
                }
            });

            panel.onDidDispose(() => {
                changeDisposable.dispose();
                messageDisposable.dispose();
            });

            update();

            function update() {
                const editor = vscode.window.activeTextEditor;
                if (!editor) return;

                const document = editor.document;
                if (document.languageId !== 'vue') return;

                panel.title = 'Preview ' + path.basename(document.fileName);
                panel.webview.html = `
<style>
body {
    padding: 0;
}
</style>
<script>
const vscode = acquireVsCodeApi();
window.onmessage = function(e) {
    vscode.postMessage(JSON.parse(e.data));
};
</script>
<iframe src="${serverUrl.value}${document.uri.fsPath}" frameborder="0" style="display: block; margin: 0px; overflow: hidden; width: 100%; height: 100vh;" />
`;
                lastEditor = editor;
            }
        });
        serverUrl.show();
    }));
}
