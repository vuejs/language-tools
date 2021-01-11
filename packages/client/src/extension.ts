import * as path from 'upath';
import * as vscode from 'vscode';
import * as lsp from 'vscode-languageclient/node';
import * as splitEditors from './features/splitEditors';
import * as callGraph from './features/callGraph';
import * as showReferences from './features/showReferences';
import * as documentVersion from './features/documentVersion';
import * as formatAll from './features/formatAll';
import * as verifyAll from './features/verifyAll';
import * as virtualFiles from './features/virtualFiles';
import * as restart from './features/restart';
import * as tagClosing from './features/tagClosing';
import * as semanticTokens from './features/semanticTokens';

let apiClient: lsp.LanguageClient;
let docClient: lsp.LanguageClient;
let htmlClient: lsp.LanguageClient;

export async function activate(context: vscode.ExtensionContext) {
	apiClient = createLanguageService(context, 'api', 'Volar - API', 6009, true);
	docClient = createLanguageService(context, 'doc', 'Volar - Document', 6010, true);
	htmlClient = createLanguageService(context, 'html', 'Volar - HTML', 6011, false);

	splitEditors.activate(context);
	callGraph.activate(context, apiClient);
	showReferences.activate(context, apiClient);
	documentVersion.activate(context, docClient);
	formatAll.activate(context, apiClient);
	verifyAll.activate(context, docClient);
	virtualFiles.activate(context, docClient);
	tagClosing.activate(context, htmlClient);
	semanticTokens.activate(context, docClient);
	restart.activate(context, [apiClient, docClient]);

	// TODO: active by vue block lang
	startEmbeddedLanguageServices();
}

export function deactivate(): Thenable<void> | undefined {
	return apiClient?.stop() && docClient?.stop() && htmlClient?.stop();
}

function createLanguageService(context: vscode.ExtensionContext, mode: string, name: string, port: number, fileOnly: boolean) {
	// The server is implemented in node
	let serverModule = context.asAbsolutePath(path.join('node_modules', '@volar', 'server', 'out', 'server.js'));
	// The debug options for the server
	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	let debugOptions = { execArgv: ['--nolazy', '--inspect=' + port] };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	let serverOptions: lsp.ServerOptions = {
		run: { module: serverModule, transport: lsp.TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: lsp.TransportKind.ipc,
			options: debugOptions
		},
	};

	// Options to control the language client
	let clientOptions: lsp.LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: fileOnly ?
			[
				{ scheme: 'file', language: 'vue' },
				{ scheme: 'file', language: 'typescript' },
				{ scheme: 'file', language: 'typescriptreact' },
			] : [
				{ language: 'vue' },
				{ language: 'typescript' },
				{ language: 'typescriptreact' },
			],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
		},
		initializationOptions: {
			appRoot: vscode.env.appRoot,
			mode: mode,
		},
	};

	// Create the language client and start the client.
	const client = new lsp.LanguageClient(
		name,
		serverOptions,
		clientOptions,
	);

	// Start the client. This will also launch the server
	client.start();

	return client;
}
async function startEmbeddedLanguageServices() {
	const ts = vscode.extensions.getExtension('vscode.typescript-language-features');
	const css = vscode.extensions.getExtension('vscode.css-language-features');
	const html = vscode.extensions.getExtension('vscode.html-language-features');

	if (ts && !ts.isActive) {
		await ts.activate();
	}
	if (css && !css.isActive) {
		await css.activate();
	}
	if (html && !html.isActive) {
		await html.activate();
	}

	vscode.languages.setLanguageConfiguration('vue', {
		wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\$\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\s]+)/g,
	});
	vscode.languages.setLanguageConfiguration('jade', {
		wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\$\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\s]+)/g,
	});
}
