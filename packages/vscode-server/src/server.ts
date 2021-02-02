import {
	ProposedFeatures,
	InitializeParams,
	TextDocumentSyncKind,
	InitializeResult,
	RenameRequest,
	TextDocumentRegistrationOptions,
	ReferencesRequest,
	DefinitionRequest,
	TypeDefinitionRequest,
	HoverRequest,
	ExecuteCommandRequest,
	CompletionRequest,
	createConnection,
	SelectionRangeRequest,
	SignatureHelpRequest,
	WorkspaceEdit,
	CodeLensRequest,
	CallHierarchyPrepareRequest,
	// doc
	DocumentHighlightRequest,
	DocumentSymbolRequest,
	DocumentLinkRequest,
	DocumentColorRequest,
	DidChangeConfigurationNotification,
	// html
	FoldingRangeRequest,
	LinkedEditingRangeRequest,
	DocumentFormattingRequest,
} from 'vscode-languageserver/node';
import { createLanguageServiceHost } from './languageServiceHost';
import { Commands, triggerCharacter } from '@volar/vscode-vue-languageservice';
import { TextDocuments } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
	ServerInitializationOptions,
	D3Request,
	FormatAllScriptsRequest,
	uriToFsPath,
	RestartServerNotification,
	// doc
	VerifyAllScriptsRequest,
	WriteVirtualFilesRequest,
	SemanticTokenLegendRequest,
	SemanticTokensChangedNotification,
	RangeSemanticTokensRequest,
	DocumentVersionRequest,
	// html
	TagCloseRequest,
	notEmpty,
} from '@volar/shared';
import * as upath from 'upath';
import { semanticTokenLegend } from '@volar/vscode-vue-languageservice';
import * as fs from 'fs-extra';
import { createNoStateLanguageService } from '@volar/vscode-vue-languageservice';
import { margeWorkspaceEdits } from '@volar/vscode-vue-languageservice';
import { codeLensOptions } from '@volar/vscode-vue-languageservice';
import { loadVscodeTypescript } from '@volar/shared';

const hosts: ReturnType<typeof createLanguageServiceHost>[] = [];

const connection = createConnection(ProposedFeatures.all);
connection.onInitialize(onInitialize);
connection.onInitialized(onInitialized);
connection.onDidChangeConfiguration(updateConfigs);
connection.listen();

const documents = new TextDocuments(TextDocument);
documents.listen(connection);

const vueOnly: TextDocumentRegistrationOptions = {
	documentSelector: [{ language: 'vue' }],
};
const both: TextDocumentRegistrationOptions = {
	documentSelector: [
		{ language: 'vue' },
		{ language: 'javascript' },
		{ language: 'typescript' },
		{ language: 'javascriptreact' },
		{ language: 'typescriptreact' },
	],
};
let mode: 'api' | 'doc' | 'html' = 'api';
let appRoot: string;

async function updateConfigs() {
	const [
		codeLensReferences,
		codeLensPugTool,
		codeLensRefScriptSetupTool,
	] = await Promise.all([
		connection.workspace.getConfiguration('volar.codeLens.references'),
		connection.workspace.getConfiguration('volar.codeLens.pugTools'),
		connection.workspace.getConfiguration('volar.codeLens.scriptSetupTools'),
	]);
	codeLensOptions.references = codeLensReferences;
	codeLensOptions.pugTool = codeLensPugTool;
	codeLensOptions.scriptSetupTool = codeLensRefScriptSetupTool;
}
function onInitialize(params: InitializeParams) {

	const options: ServerInitializationOptions = params.initializationOptions;

	mode = options.mode;
	appRoot = options.appRoot;

	if (mode === 'html') {
		initLanguageServiceHtml();
	}
	else if (params.workspaceFolders) {
		for (const workspaceFolder of params.workspaceFolders) {
			if (workspaceFolder.uri.startsWith('file:/')) {
				switch (mode) {
					case 'api': initLanguageServiceApi(uriToFsPath(workspaceFolder.uri)); break;
					case 'doc': initLanguageServiceDoc(uriToFsPath(workspaceFolder.uri)); break;
				}
			}
		}
	}

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
		}
	};

	if (mode === 'api') {
		result.capabilities.workspace = {
			fileOperations: {
				willRename: {
					filters: [
						{ pattern: { glob: '**/*.vue' } },
						{ pattern: { glob: '**/*.js' } },
						{ pattern: { glob: '**/*.ts' } },
						{ pattern: { glob: '**/*.jsx' } },
						{ pattern: { glob: '**/*.tsx' } },
					]
				}
			}
		}
	}

	return result;
}
async function onInitialized() {
	switch (mode) {
		case 'api': onInitializedApi(); break;
		case 'doc': onInitializedDoc(); break;
		case 'html': onInitializedHtml(); break;
	}
	connection.client.register(DidChangeConfigurationNotification.type, undefined);
	updateConfigs();
}
function initLanguageServiceApi(rootPath: string) {

	const host = createLanguageServiceHost(loadVscodeTypescript(appRoot), connection, documents, rootPath);
	hosts.push(host);

	// custom requests
	connection.onNotification(RestartServerNotification.type, async () => {
		host.restart();
	});
	connection.onRequest(D3Request.type, handler => {
		const document = documents.get(handler.uri);
		if (!document) return;
		return host.bestMatch(document.uri)?.getD3(document);
	});
	connection.onRequest(FormatAllScriptsRequest.type, async options => {
		const progress = await connection.window.createWorkDoneProgress();
		progress.begin('Format', 0, '', true);
		for (const [_, service] of host.services) {
			const sourceFiles = service.languageService.getAllSourceFiles();
			let i = 0;
			for (const sourceFile of sourceFiles) {
				if (progress.token.isCancellationRequested) {
					continue;
				}
				const doc = sourceFile.getTextDocument();
				const edits = service.languageService.doFormatting(doc, options) ?? [];
				const workspaceEdit: WorkspaceEdit = { changes: { [doc.uri]: edits } };
				await connection.workspace.applyEdit(workspaceEdit);
				progress.report(i++ / sourceFiles.length * 100, upath.relative(service.languageService.rootPath, uriToFsPath(doc.uri)));
			}
		}
		progress.done();
	});

	connection.onCompletion(async handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;

		return host.bestMatch(document.uri)?.doComplete(
			document,
			handler.position,
			handler.context,
			async syntax => await getEmmetConfiguration(syntax),
		);

		async function getEmmetConfiguration(syntax: string) {
			const emmetConfig = await connection.workspace.getConfiguration('emmet');
			const syntaxProfiles = Object.assign({}, emmetConfig['syntaxProfiles'] || {});
			const preferences = Object.assign({}, emmetConfig['preferences'] || {});
			// jsx, xml and xsl syntaxes need to have self closing tags unless otherwise configured by user
			if (syntax === 'jsx' || syntax === 'xml' || syntax === 'xsl') {
				syntaxProfiles[syntax] = syntaxProfiles[syntax] || {};
				if (typeof syntaxProfiles[syntax] === 'object'
					&& !syntaxProfiles[syntax].hasOwnProperty('self_closing_tag') // Old Emmet format
					&& !syntaxProfiles[syntax].hasOwnProperty('selfClosingStyle') // Emmet 2.0 format
				) {
					syntaxProfiles[syntax] = {
						...syntaxProfiles[syntax],
						selfClosingStyle: 'xml'
					};
				}
			}

			return {
				preferences,
				showExpandedAbbreviation: emmetConfig['showExpandedAbbreviation'],
				showAbbreviationSuggestions: emmetConfig['showAbbreviationSuggestions'],
				syntaxProfiles,
				variables: emmetConfig['variables'],
				excludeLanguages: emmetConfig['excludeLanguages'],
				showSuggestionsAsSnippets: emmetConfig['showSuggestionsAsSnippets']
			};
		}
	});
	connection.onCompletionResolve(async item => {
		const uri = item.data?.uri;
		return host.bestMatch(uri)?.doCompletionResolve(item) ?? item;
	});
	connection.onHover(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host.bestMatch(document.uri)?.doHover(document, handler.position);
	});
	connection.onSignatureHelp(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host.bestMatch(document.uri)?.getSignatureHelp(document, handler.position);
	});
	connection.onSelectionRanges(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host.bestMatch(document.uri)?.getSelectionRanges(document, handler.positions);
	});
	connection.onPrepareRename(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host.bestMatch(document.uri)?.rename.onPrepare(document, handler.position); // TODO: https://github.com/microsoft/vscode-languageserver-node/issues/735
	});
	connection.onRenameRequest(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host.bestMatch(document.uri)?.rename.doRename(document, handler.position, handler.newName);
	});
	connection.onCodeLens(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host.bestMatch(document.uri)?.getCodeLens(document);
	});
	connection.onCodeLensResolve(codeLens => {
		const uri = codeLens.data?.uri;
		return host.bestMatch(uri)?.doCodeLensResolve(codeLens) ?? codeLens;
	});
	connection.onExecuteCommand(handler => {
		const uri = handler.arguments?.[0];
		const document = documents.get(uri);
		if (!document) return undefined;
		return host.bestMatch(uri)?.doExecuteCommand(document, handler.command, handler.arguments, connection);
	});
	// vue & ts
	connection.onReferences(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host.allMatches(document.uri).map(ls => {
			let result = ls.findReferences(document, handler.position);
			if (document.languageId !== 'vue') {
				result = result.filter(loc => ls.getSourceFile(loc.uri));
			}
			return result;
		}).flat();
	});
	connection.onDefinition(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		const ls = host.bestMatch(document.uri);
		if (ls) {
			let result = ls.findDefinition(document, handler.position);
			if (document.languageId !== 'vue') {
				result = result.filter(loc => ls.getSourceFile(loc.uri));
			}
			return result;
		}
	});
	connection.onTypeDefinition(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		const ls = host.bestMatch(document.uri);
		if (ls) {
			let result = ls.findTypeDefinition(document, handler.position);
			if (document.languageId !== 'vue') {
				result = result.filter(loc => ls.getSourceFile(loc.uri));
			}
			return result;
		}
	});
	connection.languages.callHierarchy.onPrepare(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return [];
		const items = host.bestMatch(document.uri)?.callHierarchy.onPrepare(document, handler.position);
		return items?.length ? items : null;
	});
	connection.languages.callHierarchy.onIncomingCalls(handler => {
		const { uri } = handler.item.data as { uri: string };
		return host.bestMatch(uri)?.callHierarchy.onIncomingCalls(handler.item) ?? [];
	});
	connection.languages.callHierarchy.onOutgoingCalls(handler => {
		const { uri } = handler.item.data as { uri: string };
		return host.bestMatch(uri)?.callHierarchy.onOutgoingCalls(handler.item) ?? [];
	});
	connection.workspace.onWillRenameFiles(handler => {
		const edits = handler.files
			.map(file => {
				return host.bestMatch(file.oldUri)?.rename.onRenameFile(file.oldUri, file.newUri);
			})
			.filter(notEmpty)

		if (edits.length) {
			const result = edits[0];
			margeWorkspaceEdits(result, ...edits.slice(1));
			return result;
		}

		return null;
	});
}
function initLanguageServiceDoc(rootPath: string) {

	const host = createLanguageServiceHost(loadVscodeTypescript(appRoot), connection, documents, rootPath, async (uri: string) => {
		return await connection.sendRequest(DocumentVersionRequest.type, { uri });
	}, async () => {
		await connection.sendNotification(SemanticTokensChangedNotification.type);
	});
	hosts.push(host);

	connection.onNotification(RestartServerNotification.type, async () => {
		host.restart();
	});
	connection.onRequest(WriteVirtualFilesRequest.type, async () => {
		const progress = await connection.window.createWorkDoneProgress();
		progress.begin('Write', 0, '', true);
		for (const [_, service] of host.services) {
			const globalDocs = service.languageService.getGlobalDocs();
			for (const globalDoc of globalDocs) {
				await fs.writeFile(uriToFsPath(globalDoc.uri), globalDoc.getText(), "utf8");
			}
			const sourceFiles = service.languageService.getAllSourceFiles();
			let i = 0;
			for (const sourceFile of sourceFiles) {
				for (const [uri, doc] of sourceFile.getTsDocuments()) {
					if (progress.token.isCancellationRequested) {
						continue;
					}
					await fs.writeFile(uriToFsPath(uri), doc.getText(), "utf8");
				}
				progress.report(i++ / sourceFiles.length * 100, upath.relative(service.languageService.rootPath, uriToFsPath(sourceFile.uri)));
			}
		}
		progress.done();
	});
	connection.onRequest(VerifyAllScriptsRequest.type, async () => {
		const progress = await connection.window.createWorkDoneProgress();
		progress.begin('Verify', 0, '', true);
		for (const [_, service] of host.services) {
			const sourceFiles = service.languageService.getAllSourceFiles();
			let i = 0;
			for (const sourceFile of sourceFiles) {
				if (progress.token.isCancellationRequested) {
					continue;
				}
				const doc = sourceFile.getTextDocument();
				await service.languageService.doValidation(doc, result => {
					connection.sendDiagnostics({ uri: doc.uri, diagnostics: result });
				});
				progress.report(i++ / sourceFiles.length * 100, upath.relative(service.languageService.rootPath, uriToFsPath(sourceFile.uri)));
			}
		}
		progress.done();
	});

	connection.onDocumentColor(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host.bestMatch(document.uri)?.findDocumentColors(document);
	});
	connection.onColorPresentation(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host.bestMatch(document.uri)?.getColorPresentations(document, handler.color, handler.range);
	});
	connection.onDocumentHighlight(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host.bestMatch(document.uri)?.findDocumentHighlights(document, handler.position);
	});
	connection.onDocumentSymbol(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host.bestMatch(document.uri)?.findDocumentSymbols(document);
	});
	connection.onDocumentLinks(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host.bestMatch(document.uri)?.findDocumentLinks(document);
	});
	connection.onRequest(RangeSemanticTokensRequest.type, async handler => {
		// TODO: blocked diagnostics request
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;
		return host.bestMatch(document.uri)?.getSemanticTokens(document, handler.range);
	});
	connection.onRequest(SemanticTokenLegendRequest.type, () => semanticTokenLegend);
}
function initLanguageServiceHtml() {

	const ls = createNoStateLanguageService({ typescript: loadVscodeTypescript(appRoot) });

	connection.onRequest(TagCloseRequest.type, handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;
		return ls.doAutoClose(document, handler.position);
	});
	connection.onDocumentFormatting(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return ls.doFormatting(document, handler.options);
	});
	connection.onFoldingRanges(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return ls.getFoldingRanges(document);
	});
	connection.languages.onLinkedEditingRange(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;
		return ls.findLinkedEditingRanges(document, handler.position);
	});
}
function onInitializedApi() {
	connection.client.register(ReferencesRequest.type, both);
	connection.client.register(DefinitionRequest.type, both);
	connection.client.register(CallHierarchyPrepareRequest.type, both);
	connection.client.register(TypeDefinitionRequest.type, both);
	connection.client.register(HoverRequest.type, vueOnly);
	connection.client.register(RenameRequest.type, {
		documentSelector: vueOnly.documentSelector,
		prepareProvider: true,
	});
	connection.client.register(SelectionRangeRequest.type, vueOnly);
	connection.client.register(CodeLensRequest.type, {
		documentSelector: both.documentSelector,
		resolveProvider: true,
	});
	connection.client.register(SignatureHelpRequest.type, {
		documentSelector: vueOnly.documentSelector,
		triggerCharacters: ['(', ',', '<'],
		retriggerCharacters: [')'],
	});
	connection.client.register(ExecuteCommandRequest.type, {
		commands: [
			Commands.HTML_TO_PUG,
			Commands.PUG_TO_HTML,
			Commands.SWITCH_REF_SUGAR,
			Commands.SHOW_REFERENCES,
		]
	});
	connection.client.register(CompletionRequest.type, {
		documentSelector: vueOnly.documentSelector,
		triggerCharacters: [...triggerCharacter.typescript, ...triggerCharacter.html],
		resolveProvider: true,
	});
	for (const host of hosts) {
		host.onConnectionInited();
	}
}
function onInitializedDoc() {
	connection.client.register(DocumentHighlightRequest.type, vueOnly);
	connection.client.register(DocumentSymbolRequest.type, vueOnly);
	connection.client.register(DocumentLinkRequest.type, vueOnly);
	connection.client.register(DocumentColorRequest.type, vueOnly);
	for (const host of hosts) {
		host.onConnectionInited();
	}
}
function onInitializedHtml() {
	const vueOnly: TextDocumentRegistrationOptions = {
		documentSelector: [{ language: 'vue' }],
	};
	connection.client.register(FoldingRangeRequest.type, vueOnly);
	connection.client.register(LinkedEditingRangeRequest.type, vueOnly);
	connection.client.register(DocumentFormattingRequest.type, vueOnly);
}
