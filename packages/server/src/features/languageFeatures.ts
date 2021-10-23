import * as shared from '@volar/shared';
import * as vue from 'vscode-vue-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver';
import type { Projects } from '../projects';
import { fileRenamings, renameFileContentCache, getScriptText } from '../project';
import type { createLsConfigs } from '../configs';

export function register(
	ts: vue.Modules['typescript'],
	connection: vscode.Connection,
	documents: vscode.TextDocuments<TextDocument>,
	getProjects: () => Projects | undefined,
	features: NonNullable<shared.ServerInitializationOptions['languageFeatures']>,
	lsConfigs: ReturnType<typeof createLsConfigs> | undefined,
	params: vscode.InitializeParams,
) {
	connection.onCompletion(async handler => {
		const list = await getProjects()
			?.get(handler.textDocument.uri)?.service
			.doComplete(
				handler.textDocument.uri,
				handler.position,
				handler.context,
				() => connection.workspace.getConfiguration('volar.completion.autoImportComponent'),
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
		return getProjects()?.get(uri)?.service.doCompletionResolve(item, newPosition) ?? item;
	});
	connection.onHover(async handler => {
		return await getProjects()
			?.get(handler.textDocument.uri)?.service
			.doHover(handler.textDocument.uri, handler.position);
	});
	connection.onSignatureHelp(handler => {
		return getProjects()
			?.get(handler.textDocument.uri)?.service
			.getSignatureHelp(handler.textDocument.uri, handler.position, handler.context);
	});
	connection.onPrepareRename(handler => {
		return getProjects()
			?.get(handler.textDocument.uri)?.service
			.prepareRename(handler.textDocument.uri, handler.position);
	});
	connection.onRenameRequest(async handler => {
		return await getProjects()
			?.get(handler.textDocument.uri)?.service
			.doRename(handler.textDocument.uri, handler.position, handler.newName);
	});
	connection.onCodeLens(async handler => {
		return getProjects()
			?.get(handler.textDocument.uri)?.service
			.getCodeLens(handler.textDocument.uri, await lsConfigs?.getCodeLensConfigs());
	});
	connection.onCodeLensResolve(codeLens => {
		const uri = codeLens.data?.uri;
		return getProjects()
			?.get(uri)?.service
			.doCodeLensResolve(codeLens, typeof features.codeLens === 'object' && features.codeLens.showReferencesNotification) ?? codeLens;
	});
	connection.onExecuteCommand(handler => {
		const uri = handler.arguments?.[0];
		return getProjects()
			?.get(uri)?.service
			.__internal__.executeCommand(uri, handler.command, handler.arguments, connection);
	});
	connection.onCodeAction(async handler => {
		const uri = handler.textDocument.uri;
		const project = getProjects()?.get(uri);
		if (project) {
			const codeActions = await project.service.getCodeActions(uri, handler.range, handler.context);
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
		const project = uri ? getProjects()?.get(uri) : undefined;
		if (project) {
			return await project.service.doCodeActionResolve(codeAction);
		}
		return codeAction;
	});
	connection.onReferences(async handler => {
		return await getProjects()
			?.get(handler.textDocument.uri)?.service
			.findReferences(handler.textDocument.uri, handler.position);
	});
	connection.onDefinition(async handler => {
		return await getProjects()
			?.get(handler.textDocument.uri)?.service
			.findDefinition(handler.textDocument.uri, handler.position);
	});
	connection.onTypeDefinition(handler => {
		return getProjects()
			?.get(handler.textDocument.uri)?.service
			.findTypeDefinition(handler.textDocument.uri, handler.position);
	});
	connection.onDocumentHighlight(handler => {
		return getProjects()
			?.get(handler.textDocument.uri)?.service
			.findDocumentHighlights(handler.textDocument.uri, handler.position);
	});
	connection.onDocumentLinks(async handler => {
		return await getProjects()
			?.get(handler.textDocument.uri)?.service
			.findDocumentLinks(handler.textDocument.uri);
	});
	connection.onWorkspaceSymbol(async (handler, token) => {
		const projects = getProjects();
		if (projects) {

			const _projects = projects.projects.size ? projects.projects : projects.inferredProjects;
			let results: vscode.SymbolInformation[] = [];

			for (const [_, project] of _projects) {

				if (token.isCancellationRequested)
					return;

				results = results.concat(await project.getLanguageService().findWorkspaceSymbols(handler.query));
			}

			return results;
		}
	});
	connection.languages.callHierarchy.onPrepare(async handler => {
		const items = await getProjects()
			?.get(handler.textDocument.uri)?.service
			.callHierarchy.doPrepare(handler.textDocument.uri, handler.position);
		if (items) {
			for (const item of items) {
				if (typeof item.data !== 'object') item.data = {};
				(item.data as any).__uri = handler.textDocument.uri;
			}
		}
		return items?.length ? items : null;
	});
	connection.languages.callHierarchy.onIncomingCalls(handler => {
		const data = handler.item.data as { __uri?: string } | undefined;
		const uri = data?.__uri ?? handler.item.uri;
		return getProjects()
			?.get(uri)?.service
			.callHierarchy.getIncomingCalls(handler.item) ?? [];
	});
	connection.languages.callHierarchy.onOutgoingCalls(handler => {
		const data = handler.item.data as { __uri?: string } | undefined;
		const uri = data?.__uri ?? handler.item.uri;
		return getProjects()
			?.get(uri)?.service
			.callHierarchy.getOutgoingCalls(handler.item) ?? [];
	});
	connection.languages.semanticTokens.on(async (handler, token, _, resultProgress) => {
		const result = await getProjects()
			?.get(handler.textDocument.uri)?.service
			.getSemanticTokens(handler.textDocument.uri, undefined, token, resultProgress);
		return {
			resultId: result?.resultId,
			data: result?.data ?? [],
		};
	});
	connection.languages.semanticTokens.onRange(async (handler, token, _, resultProgress) => {
		const result = await getProjects()
			?.get(handler.textDocument.uri)?.service
			.getSemanticTokens(handler.textDocument.uri, handler.range, token, resultProgress);
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
					const renameFileContent = getScriptText(ts, documents, shared.uriToFsPath(file.oldUri));
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
										change.textDocument.version = documents.get(file.newUri)?.version ?? change.textDocument.version;
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
					return await getProjects()?.get(file.oldUri)?.service.getEditsForFileRename(file.oldUri, file.newUri);
				}))).filter(shared.notEmpty);
			if (edits.length) {
				const result = edits[0];
				vue.margeWorkspaceEdits(result, ...edits.slice(1));
				return result;
			}
			return null;
		}
	});
}
