import * as path from 'upath';
import * as vscode from 'vscode';
import * as lsp from 'vscode-languageclient/node';
import * as splitEditors from './features/splitEditors';
import * as preview from './features/preview';
import * as callGraph from './features/callGraph';
import * as showReferences from './features/showReferences';
import * as documentVersion from './features/documentVersion';
import * as activeSelection from './features/activeSelection';
import * as verifyAll from './features/verifyAll';
import * as virtualFiles from './features/virtualFiles';
import * as restart from './features/restart';
import * as tagClosing from './features/tagClosing';
import * as semanticTokens from './features/semanticTokens';
import * as tsPlugin from './features/tsPlugin';
import * as tagNameCase from './features/tagNameCase';
import { ServerInitializationOptions } from '@volar/shared';

let apiClient: lsp.LanguageClient;
let docClient: lsp.LanguageClient;
let htmlClient: lsp.LanguageClient;

export async function activate(context: vscode.ExtensionContext) {
	apiClient = createLanguageService(context, 'api', 'volar-api', 'Volar - API', 6009, true);
	docClient = createLanguageService(context, 'doc', 'volar-document', 'Volar - Document', 6010, true);
	htmlClient = createLanguageService(context, 'html', 'volar-html', 'Volar - HTML', 6011, false);

	splitEditors.activate(context);
	preview.activate(context);
	tagNameCase.activate(context, apiClient);
	callGraph.activate(context, apiClient);
	showReferences.activate(context, apiClient);
	documentVersion.activate(context, docClient);
	activeSelection.activate(context, apiClient);
	verifyAll.activate(context, docClient);
	virtualFiles.activate(context, docClient);
	semanticTokens.activate(context, docClient);
	tagClosing.activate(context, htmlClient, apiClient);
	restart.activate(context, [apiClient, docClient]);
	tsPlugin.activate(context);

	startEmbeddedLanguageServices();
}

export function deactivate(): Thenable<void> | undefined {
	return apiClient?.stop() && docClient?.stop() && htmlClient?.stop();
}

function createLanguageService(context: vscode.ExtensionContext, mode: 'api' | 'doc' | 'html', id: string, name: string, port: number, fileOnly: boolean) {

	const serverModule = context.asAbsolutePath(path.join('node_modules', '@volar', 'vscode-server', 'out', 'server.js'));
	const debugOptions = { execArgv: ['--nolazy', '--inspect=' + port] };
	const serverOptions: lsp.ServerOptions = {
		run: { module: serverModule, transport: lsp.TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: lsp.TransportKind.ipc,
			options: debugOptions
		},
	};
	const serverInitOptions: ServerInitializationOptions = {
		mode: mode,
		appRoot: vscode.env.appRoot,
		language: vscode.env.language,
	};
	const clientOptions: lsp.LanguageClientOptions = {
		documentSelector: fileOnly ?
			[
				{ scheme: 'file', language: 'vue' },
				{ scheme: 'file', language: 'javascript' },
				{ scheme: 'file', language: 'typescript' },
				{ scheme: 'file', language: 'javascriptreact' },
				{ scheme: 'file', language: 'typescriptreact' },
			] : [
				{ language: 'vue' },
				{ language: 'javascript' },
				{ language: 'typescript' },
				{ language: 'javascriptreact' },
				{ language: 'typescriptreact' },
			],
		initializationOptions: serverInitOptions,
	};
	const client = new lsp.LanguageClient(
		id,
		name,
		serverOptions,
		clientOptions,
	);
	context.subscriptions.push(client.start());

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

	/* from html-language-features */
	const EMPTY_ELEMENTS: string[] = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'menuitem', 'meta', 'param', 'source', 'track', 'wbr'];
	vscode.languages.setLanguageConfiguration('vue', {
		indentationRules: {
			increaseIndentPattern: /<(?!\?|(?:area|base|br|col|frame|hr|html|img|input|link|meta|param)\b|[^>]*\/>)([-_\.A-Za-z0-9]+)(?=\s|>)\b[^>]*>(?!.*<\/\1>)|<!--(?!.*-->)|\{[^}"']*$/,
			decreaseIndentPattern: /^\s*(<\/(?!html)[-_\.A-Za-z0-9]+\b[^>]*>|-->|\})/
		},
		wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\$\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\s]+)/g,
		onEnterRules: [
			{
				beforeText: new RegExp(`<(?!(?:${EMPTY_ELEMENTS.join('|')}))([_:\\w][_:\\w-.\\d]*)([^/>]*(?!/)>)[^<]*$`, 'i'),
				afterText: /^<\/([_:\w][_:\w-.\d]*)\s*>/i,
				action: { indentAction: vscode.IndentAction.IndentOutdent }
			},
			{
				beforeText: new RegExp(`<(?!(?:${EMPTY_ELEMENTS.join('|')}))(\\w[\\w\\d]*)([^/>]*(?!/)>)[^<]*$`, 'i'),
				action: { indentAction: vscode.IndentAction.Indent }
			}
		],
	});
	vscode.languages.setLanguageConfiguration('jade', {
		wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\$\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\s]+)/g,
	});
}
