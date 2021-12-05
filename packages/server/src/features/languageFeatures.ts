import * as shared from '@volar/shared';
import * as vue from 'vscode-vue-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver';
import type { Projects } from '../projects';
import { fileRenamings, renameFileContentCache, getScriptText } from '../project';
import type { createLsConfigs } from '../configs';
import type { Configuration } from 'vscode-languageserver/lib/common/configuration';

export function register(
	ts: vue.Modules['typescript'],
	connection: vscode.Connection,
	configuration: Configuration | undefined,
	documents: vscode.TextDocuments<TextDocument>,
	getProjects: () => Projects | undefined,
	features: NonNullable<shared.ServerInitializationOptions['languageFeatures']>,
	lsConfigs: ReturnType<typeof createLsConfigs> | undefined,
	params: vscode.InitializeParams,
) {
	connection.onCompletion(async handler => {
		const languageService = await getLanguageService(handler.textDocument.uri);
		const list = await languageService?.doComplete(
			handler.textDocument.uri,
			handler.position,
			handler.context,
			async () => await configuration?.getConfiguration('volar.completion.autoImportComponent') ?? true,
			async (uri) => {
				if (features.completion?.getDocumentNameCasesRequest) {
					return await connection.sendRequest(shared.GetDocumentNameCasesRequest.type, { uri });
				}
				return {
					tagNameCase: features.completion!.defaultTagNameCase,
					attrNameCase: features.completion!.defaultAttrNameCase,
				};
			},
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
		const uri: string | undefined = item.data?.uri;
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
		return languageService?.getCodeLens(handler.textDocument.uri, await lsConfigs?.getCodeLensConfigs());
	});
	connection.onCodeLensResolve(async codeLens => {
		const uri = codeLens.data?.uri;
		const languageService = await getLanguageService(uri);
		return languageService?.doCodeLensResolve(codeLens, typeof features.codeLens === 'object' && features.codeLens.showReferencesNotification) ?? codeLens;
	});
	connection.onExecuteCommand(async handler => {
		const uri = handler.arguments?.[0];
		const languageService = await getLanguageService(uri);
		languageService?.__internal__.executeCommand(uri, handler.command, handler.arguments, connection);
	});
	connection.onCodeAction(async handler => {
		const uri = handler.textDocument.uri;
		const languageService = await getLanguageService(uri);
		if (languageService) {
			const codeActions = await languageService.getCodeActions(uri, handler.range, handler.context);
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
		const languageService = await getLanguageService(handler.textDocument.uri);
		const result = await languageService?.getSemanticTokens(handler.textDocument.uri, undefined, token, resultProgress);
		return {
			resultId: result?.resultId,
			data: result?.data ?? [],
		};
	});
	connection.languages.semanticTokens.onRange(async (handler, token, _, resultProgress) => {
		const languageService = await getLanguageService(handler.textDocument.uri);
		const result = await languageService?.getSemanticTokens(handler.textDocument.uri, handler.range, token, resultProgress);
		return {
			resultId: result?.resultId,
			data: result?.data ?? [],
		};
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
										change.textDocument.version = shared.getDocumentSafely(documents, file.newUri)?.version ?? change.textDocument.version;
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

	async function getLanguageService(uri: string) {
		const projects = await getProjects();
		const project = (await projects?.getProject(uri))?.project;
		return project?.getLanguageService();
	}
}
