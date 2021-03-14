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
	CodeActionRequest,
	// doc
	DocumentHighlightRequest,
	DocumentSymbolRequest,
	DocumentLinkRequest,
	DocumentColorRequest,
	DidChangeConfigurationNotification,
	Diagnostic,
	DiagnosticSeverity,
	// html
	FoldingRangeRequest,
	LinkedEditingRangeRequest,
	DocumentFormattingRequest,
	CodeActionKind,
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
	RefCloseRequest,
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
import * as path from 'upath';
import { semanticTokenLegend } from '@volar/vscode-vue-languageservice';
import * as fs from 'fs-extra';
import { createNoStateLanguageService } from '@volar/vscode-vue-languageservice';
import { margeWorkspaceEdits } from '@volar/vscode-vue-languageservice';
import { codeLensOptions } from '@volar/vscode-vue-languageservice';
import { defaultLanguages } from '@volar/vscode-vue-languageservice';
import { loadVscodeTypescript, loadVscodeTypescriptLocalized } from '@volar/shared';
import type * as emmet from 'vscode-emmet-helper';

const hosts: ReturnType<typeof createLanguageServiceHost>[] = [];

const connection = createConnection(ProposedFeatures.all);
connection.onInitialize(onInitialize);
connection.onInitialized(onInitialized);
connection.onDidChangeConfiguration(updateConfigs);
connection.listen();

const documents = new TextDocuments(TextDocument);
documents.listen(connection);

const vueOnly: TextDocumentRegistrationOptions = {
	documentSelector: [
		{ scheme: 'file', language: 'vue' },
	],
};
const both: TextDocumentRegistrationOptions = {
	documentSelector: [
		{ scheme: 'file', language: 'vue' },
		{ scheme: 'file', language: 'javascript' },
		{ scheme: 'file', language: 'typescript' },
		{ scheme: 'file', language: 'javascriptreact' },
		{ scheme: 'file', language: 'typescriptreact' },
	],
};
let mode: 'api' | 'doc' | 'html' = 'api';
let appRoot: string;
let language: string;
let emmetConfig: any;

function updateConfigs() {
	updateCodeLens();
	updateEmmet();
	updateDefaultLanguage();

	async function updateCodeLens() {
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
	async function updateDefaultLanguage() {
		const defalutStyleLanguage = await connection.workspace.getConfiguration('volar.style.defaultLanguage');
		defaultLanguages.style = defalutStyleLanguage;
	}
	async function updateEmmet() {
		emmetConfig = await connection.workspace.getConfiguration('emmet');
	}
}
function onInitialize(params: InitializeParams) {

	const options: ServerInitializationOptions = params.initializationOptions;

	mode = options.mode;
	appRoot = options.appRoot;
	language = options.language;

	if (options.config['volar.style.defaultLanguage']) {
		defaultLanguages.style = options.config['volar.style.defaultLanguage'];
	}

	if (mode === 'html') {
		initLanguageServiceHtml();
	}
	else if (params.workspaceFolders) {
		const folders = params.workspaceFolders
			.map(folder => folder.uri)
			.filter(uri => uri.startsWith('file:/'))
			.map(uri => uriToFsPath(uri));
		switch (mode) {
			case 'api': initLanguageServiceApi(folders); break;
			case 'doc': initLanguageServiceDoc(folders); break;
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
function initLanguageServiceApi(rootPaths: string[]) {

	const host = createLanguageServiceHost(loadVscodeTypescript(appRoot), loadVscodeTypescriptLocalized(appRoot, language), connection, documents, rootPaths);
	hosts.push(host);

	// custom requests
	connection.onNotification(RestartServerNotification.type, async () => {
		host.restart();
	});
	connection.onRequest(RefCloseRequest.type, handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;
		return host.bestMatch(document.uri)?.doRefAutoClose(document, handler.position);
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
			const ls = service.getLanguageServiceDontCreate();
			if (!ls) continue;
			const sourceFiles = ls.getAllSourceFiles();
			let i = 0;
			for (const sourceFile of sourceFiles) {
				if (progress.token.isCancellationRequested) {
					continue;
				}
				const doc = sourceFile.getTextDocument();
				progress.report(i++ / sourceFiles.length * 100, path.relative(ls.rootPath, uriToFsPath(doc.uri)));
				const edits = ls.doFormatting(doc, options) ?? [];
				const workspaceEdit: WorkspaceEdit = { changes: { [doc.uri]: edits } };
				await connection.workspace.applyEdit(workspaceEdit);
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
			getEmmetConfiguration,
		);
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
		return host.bestMatch(handler.textDocument.uri)?.rename.onPrepare(handler.textDocument.uri, handler.position);
	});
	connection.onRenameRequest(handler => {
		return host.bestMatch(handler.textDocument.uri)?.rename.doRename(handler.textDocument.uri, handler.position, handler.newName);
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
	connection.onCodeAction(handler => {
		const uri = handler.textDocument.uri;
		const tsConfig = host.bestMatchTsConfig(uri);
		const service = tsConfig ? host.services.get(tsConfig)?.getLanguageService() : undefined;
		if (service) {
			const codeActions = service.getCodeActions(uri, handler.range, handler.context);
			for (const codeAction of codeActions) {
				if (codeAction.data && typeof codeAction.data === 'object') {
					(codeAction.data as any).tsConfig = tsConfig;
				}
				else {
					codeAction.data = { tsConfig };
				}
			}
			return codeActions;
		}
	});
	connection.onCodeActionResolve(codeAction => {
		const tsConfig: string | undefined = (codeAction.data as any)?.tsConfig;
		const service = tsConfig ? host.services.get(tsConfig)?.getLanguageService() : undefined;
		if (service) {
			return service.doCodeActionResolve(codeAction);
		}
		return codeAction;
	});
	connection.onReferences(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host.bestMatch(document.uri)?.findReferences(document.uri, handler.position);
	});
	connection.onDefinition(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host.bestMatch(document.uri)?.findDefinition(document.uri, handler.position);
	});
	connection.onTypeDefinition(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host.bestMatch(document.uri)?.findTypeDefinition(document.uri, handler.position);
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
function initLanguageServiceDoc(rootPaths: string[]) {

	const host = createLanguageServiceHost(loadVscodeTypescript(appRoot), loadVscodeTypescriptLocalized(appRoot, language), connection, documents, rootPaths, async (uri: string) => {
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
			const ls = service.getLanguageServiceDontCreate();
			if (!ls) continue;
			const globalDocs = ls.getGlobalDocs();
			for (const globalDoc of globalDocs) {
				await fs.writeFile(uriToFsPath(globalDoc.uri), globalDoc.getText(), "utf8");
			}
			const sourceFiles = ls.getAllSourceFiles();
			let i = 0;
			for (const sourceFile of sourceFiles) {
				progress.report(i++ / sourceFiles.length * 100, path.relative(ls.rootPath, uriToFsPath(sourceFile.uri)));
				for (const [uri, doc] of sourceFile.getTsDocuments()) {
					if (progress.token.isCancellationRequested) {
						break;
					}
					await fs.writeFile(uriToFsPath(uri), doc.getText(), "utf8");
				}
			}
		}
		progress.done();
	});
	connection.onRequest(VerifyAllScriptsRequest.type, async () => {

		let errors = 0;
		let warnings = 0;

		const progress = await connection.window.createWorkDoneProgress();
		progress.begin('Verify', 0, '', true);
		for (const [_, service] of host.services) {
			const ls = service.getLanguageServiceDontCreate();
			if (!ls) continue;
			const sourceFiles = ls.getAllSourceFiles();
			let i = 0;
			for (const sourceFile of sourceFiles) {
				progress.report(i++ / sourceFiles.length * 100, path.relative(ls.rootPath, uriToFsPath(sourceFile.uri)));
				if (progress.token.isCancellationRequested) {
					continue;
				}
				const doc = sourceFile.getTextDocument();
				let _result: Diagnostic[] = [];
				await ls.doValidation(doc, result => {
					connection.sendDiagnostics({ uri: doc.uri, diagnostics: result });
					_result = result;
				});
				errors += _result.filter(error => error.severity === DiagnosticSeverity.Error).length;
				warnings += _result.filter(error => error.severity === DiagnosticSeverity.Warning).length;
			}
		}
		progress.done();

		connection.window.showInformationMessage(`Verification complete. Found ${errors} errors and ${warnings} warnings.`);
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
	connection.client.register(ReferencesRequest.type, vueOnly);
	connection.client.register(DefinitionRequest.type, vueOnly);
	connection.client.register(CallHierarchyPrepareRequest.type, both);
	connection.client.register(TypeDefinitionRequest.type, vueOnly);
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
	connection.client.register(CodeActionRequest.type, {
		documentSelector: vueOnly.documentSelector,
		codeActionKinds: [
			CodeActionKind.Empty,
			CodeActionKind.QuickFix,
			CodeActionKind.Refactor,
			CodeActionKind.RefactorExtract,
			CodeActionKind.RefactorInline,
			CodeActionKind.RefactorRewrite,
			CodeActionKind.Source,
			CodeActionKind.SourceFixAll,
			CodeActionKind.SourceOrganizeImports,
		],
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
function getEmmetConfiguration(syntax: string): emmet.VSCodeEmmetConfig {
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
