import * as shared from '@volar/shared';
import * as vue from '@volar/vue-language-service';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver';
import type { Projects } from '../projects';
import { fileRenamings, renameFileContentCache, getScriptText } from '../project';
import { getDocumentSafely } from '../utils';

export function register(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	connection: vscode.Connection,
	documents: vscode.TextDocuments<TextDocument>,
	getProjects: () => Projects | undefined,
	features: NonNullable<shared.ServerInitializationOptions['languageFeatures']>,
	params: vscode.InitializeParams,
) {
	connection.onCompletion(async handler => {
		const languageService = await getLanguageService(handler.textDocument.uri);
		const list = await languageService?.doComplete(
			handler.textDocument.uri,
			handler.position,
			handler.context,
		);
		const insertReplaceSupport = params.capabilities.textDocument?.completion?.completionItem?.insertReplaceSupport ?? false;
		if (!insertReplaceSupport && list) {
			for (const item of list.items) {
				if (item.textEdit && vscode.InsertReplaceEdit.is(item.textEdit)) {
					item.textEdit = vscode.TextEdit.replace(item.textEdit.insert, item.textEdit.newText);
				}
			}
		}
		return list;
	});
	connection.onCompletionResolve(async item => {
		const uri = (item.data as { uri?: string } | undefined)?.uri;
		if (!uri) return item;
		const activeSel = features.completion?.getDocumentSelectionRequest
			? await connection.sendRequest(shared.GetEditorSelectionRequest.type)
			: undefined;
		const newPosition = activeSel?.textDocument.uri.toLowerCase() === uri.toLowerCase() ? activeSel.position : undefined;
		const languageService = await getLanguageService(uri);
		return languageService?.doCompletionResolve(item, newPosition) ?? item;
	});
	connection.onHover(async handler => {
		const languageService = await getLanguageService(handler.textDocument.uri);
		return languageService?.doHover(handler.textDocument.uri, handler.position);
	});
	connection.onSignatureHelp(async handler => {
		const languageService = await getLanguageService(handler.textDocument.uri);
		return languageService?.getSignatureHelp(handler.textDocument.uri, handler.position, handler.context);
	});
	connection.onPrepareRename(async handler => {
		const languageService = await getLanguageService(handler.textDocument.uri);
		return languageService?.prepareRename(handler.textDocument.uri, handler.position);
	});
	connection.onRenameRequest(async handler => {
		const languageService = await getLanguageService(handler.textDocument.uri);
		return languageService?.doRename(handler.textDocument.uri, handler.position, handler.newName);
	});
	connection.onCodeLens(async handler => {
		const languageService = await getLanguageService(handler.textDocument.uri);
		return languageService?.doCodeLens(handler.textDocument.uri);
	});
	connection.onCodeLensResolve(async codeLens => {
		const uri = (codeLens.data as any)?.uri as string | undefined; // TODO
		if (!uri) return codeLens;
		const languageService = await getLanguageService(uri);
		return languageService?.doCodeLensResolve(codeLens) ?? codeLens;
	});
	connection.onExecuteCommand(async (handler, token, workDoneProgress) => {

		if (handler.command === vue.executePluginCommand) {

			const args = handler.arguments as vue.ExecutePluginCommandArgs | undefined;
			if (!args) return;

			const vueLs = await getLanguageService(args[0]);
			if (!vueLs) return;

			return vueLs.doExecuteCommand(handler.command, args, {
				token,
				workDoneProgress,
				applyEdit: (paramOrEdit) => connection.workspace.applyEdit(paramOrEdit),
				sendNotification: (type, params) => connection.sendNotification(type, params),
			});
		}

		if (handler.command === 'volar.server.convertTagNameCasing') {

			const args = handler.arguments as [string, 'kebab' | 'pascal'] | undefined;
			if (!args) return;

			const vueLs = await getLanguageService(args[0]);
			if (!vueLs) return;

			return vueLs.doExecuteCommand(
				vue.executePluginCommand,
				[
					args[0],
					undefined,
					vscode.Command.create(
						'',
						vue.convertTagNameCasingCommand,
						...<vue.ConvertTagNameCasingCommandArgs>[
							args[0],
							args[1],
						]),
				], {
				token,
				workDoneProgress,
				applyEdit: (paramOrEdit) => connection.workspace.applyEdit(paramOrEdit),
				sendNotification: (type, params) => connection.sendNotification(type, params),
			});
		}
	});
	connection.onCodeAction(async handler => {
		const uri = handler.textDocument.uri;
		const languageService = await getLanguageService(uri);
		if (languageService) {
			const codeActions = await languageService.doCodeActions(uri, handler.range, handler.context) ?? [];
			for (const codeAction of codeActions) {
				if (codeAction.data && typeof codeAction.data === 'object') {
					(codeAction.data as any).uri = uri;
				}
				else {
					codeAction.data = { uri };
				}
			}
			return codeActions;
		}
	});
	connection.onCodeActionResolve(async codeAction => {
		const uri: string | undefined = (codeAction.data as any)?.uri;
		if (uri) {
			const languageService = await getLanguageService(uri);
			if (languageService) {
				return languageService.doCodeActionResolve(codeAction);
			}
		}
		return codeAction;
	});
	connection.onReferences(async handler => {
		const languageService = await getLanguageService(handler.textDocument.uri);
		return languageService?.findReferences(handler.textDocument.uri, handler.position);
	});
	connection.onImplementation(async handler => {
		const languageService = await getLanguageService(handler.textDocument.uri);
		return languageService?.findImplementations(handler.textDocument.uri, handler.position);
	});
	connection.onDefinition(async handler => {
		const languageService = await getLanguageService(handler.textDocument.uri);
		return languageService?.findDefinition(handler.textDocument.uri, handler.position);
	});
	connection.onTypeDefinition(async handler => {
		const languageService = await getLanguageService(handler.textDocument.uri);
		return languageService?.findTypeDefinition(handler.textDocument.uri, handler.position);
	});
	connection.onDocumentHighlight(async handler => {
		const languageService = await getLanguageService(handler.textDocument.uri);
		return languageService?.findDocumentHighlights(handler.textDocument.uri, handler.position);
	});
	connection.onDocumentLinks(async handler => {
		const languageService = await getLanguageService(handler.textDocument.uri);
		return languageService?.findDocumentLinks(handler.textDocument.uri);
	});
	connection.onWorkspaceSymbol(async (handler, token) => {
		const projects = getProjects();
		if (projects) {

			let results: vscode.SymbolInformation[] = [];

			for (const workspace of projects.workspaces.values()) {
				let projects = [...workspace.projects.values()];
				projects = projects.length ? projects : [workspace.getInferredProject()];
				for (const project of projects) {

					if (token.isCancellationRequested)
						return;

					const languageService = await (await project).getLanguageService();

					results = results.concat(await languageService.findWorkspaceSymbols(handler.query));
				}
			}

			return results;
		}
	});
	connection.languages.callHierarchy.onPrepare(async handler => {
		const languageService = await getLanguageService(handler.textDocument.uri);
		const items = await languageService?.callHierarchy.doPrepare(handler.textDocument.uri, handler.position);
		if (items) {
			for (const item of items) {
				if (typeof item.data !== 'object') item.data = {};
				(item.data as any).__uri = handler.textDocument.uri;
			}
		}
		return items?.length ? items : null;
	});
	connection.languages.callHierarchy.onIncomingCalls(async handler => {
		const data = handler.item.data as { __uri?: string } | undefined;
		const uri = data?.__uri ?? handler.item.uri;
		const languageService = await getLanguageService(uri);
		return languageService?.callHierarchy.getIncomingCalls(handler.item) ?? [];
	});
	connection.languages.callHierarchy.onOutgoingCalls(async handler => {
		const data = handler.item.data as { __uri?: string } | undefined;
		const uri = data?.__uri ?? handler.item.uri;
		const languageService = await getLanguageService(uri);
		return languageService?.callHierarchy.getOutgoingCalls(handler.item) ?? [];
	});
	connection.languages.semanticTokens.on(async (handler, token, _, resultProgress) => {
		return onSemanticTokens(handler, token, resultProgress);
	});
	connection.languages.semanticTokens.onRange(async (handler, token, _, resultProgress) => {
		return onSemanticTokens(handler, token, resultProgress);
	});
	connection.workspace.onWillRenameFiles(async handler => {

		const hasTsFile = handler.files.some(file => file.newUri.endsWith('.vue') || file.newUri.endsWith('.ts') || file.newUri.endsWith('.tsx'));
		const config: 'prompt' | 'always' | 'never' | null | undefined = await connection.workspace.getConfiguration(hasTsFile ? 'typescript.updateImportsOnFileMove.enabled' : 'javascript.updateImportsOnFileMove.enabled');

		if (config === 'always') {
			const renaming = new Promise<void>(async resolve => {
				for (const file of handler.files) {
					const renameFileContent = getScriptText(documents, shared.uriToFsPath(file.oldUri), ts.sys);
					if (renameFileContent) {
						renameFileContentCache.set(file.oldUri, renameFileContent);
					}
				}
				await shared.sleep(0);
				const edit = await worker();
				if (edit) {
					if (edit.documentChanges) {
						for (const change of edit.documentChanges) {
							if (vscode.TextDocumentEdit.is(change)) {
								for (const file of handler.files) {
									if (change.textDocument.uri === file.oldUri) {
										change.textDocument.uri = file.newUri;
										change.textDocument.version = getDocumentSafely(documents, file.newUri)?.version ?? change.textDocument.version;
									}
								}
							}
						}
					}
					connection.workspace.applyEdit(edit);
				}
				resolve();
			});
			fileRenamings.add(renaming);
			(async () => {
				await renaming;
				fileRenamings.delete(renaming);
				renameFileContentCache.clear();
			})();
		}

		if (config === 'prompt')
			return await worker();

		return null;

		async function worker() {
			const edits = (await Promise.all(handler.files
				.map(async file => {
					const languageService = await getLanguageService(file.oldUri);
					return languageService?.getEditsForFileRename(file.oldUri, file.newUri);
				}))).filter(shared.notEmpty);
			if (edits.length) {
				const result = edits[0];
				vue.margeWorkspaceEdits(result, ...edits.slice(1));
				return result;
			}
			return null;
		}
	});
	connection.onRequest(shared.AutoInsertRequest.type, async handler => {
		const languageService = await getLanguageService(handler.textDocument.uri);
		return languageService?.doAutoInsert(handler.textDocument.uri, handler.position, handler.options);
	});

	async function onSemanticTokens(
		handler: vscode.SemanticTokensParams | vscode.SemanticTokensRangeParams,
		token: vscode.CancellationToken,
		resultProgress?: vscode.ResultProgressReporter<vscode.SemanticTokensPartialResult>,
	) {

		const languageService = await getLanguageService(handler.textDocument.uri);
		const result = await languageService?.getSemanticTokens(
			handler.textDocument.uri,
			'range' in handler ? handler.range : undefined,
			token,
			tokens => resultProgress?.report(buildTokens(tokens)),
		) ?? [];

		return buildTokens(result);

		function buildTokens(tokens: vue.SemanticToken[]) {
			const builder = new vscode.SemanticTokensBuilder();
			const sortedTokens = tokens.sort((a, b) => a[0] - b[0] === 0 ? a[1] - b[1] : a[0] - b[0]);
			for (const token of sortedTokens) {
				builder.push(...token);
			}
			return builder.build();
		}
	}
	async function getLanguageService(uri: string) {
		const projects = await getProjects();
		const project = (await projects?.getProject(uri))?.project;
		return project?.getLanguageService();
	}
}
