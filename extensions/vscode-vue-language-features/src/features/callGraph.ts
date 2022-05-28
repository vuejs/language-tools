import * as vscode from 'vscode';
import * as shared from '@volar/shared';
import type { BaseLanguageClient } from 'vscode-languageclient';

export async function activate(context: vscode.ExtensionContext, languageClient: BaseLanguageClient) {
	context.subscriptions.push(vscode.commands.registerCommand('volar.action.showCallGraph', async () => {
		const document = vscode.window.activeTextEditor?.document;
		if (!document) return;
		let param = languageClient.code2ProtocolConverter.asTextDocumentIdentifier(document);
		const d3 = await languageClient.sendRequest(shared.D3Request.type, param);

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
`;
	}));
}
