import * as shared from '@volar/shared';
import * as vue from 'vscode-vue-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver';
import type { Projects } from '../projects';
import { fileRenamings, renameFileContentCache, getScriptText } from '../project';

export function register(
	ts: vue.Modules['typescript'],
	connection: vscode.Connection,
	documents: vscode.TextDocuments<TextDocument>,
	projects: Projects,
	features: NonNullable<shared.ServerInitializationOptions['languageFeatures']>,
) {
	connection.onCompletion(async handler => {
		return await projects
			.get(handler.textDocument.uri)?.service
			.doComplete(
				handler.textDocument.uri,
				handler.position,
				handler.context,
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
	});
	connection.onCompletionResolve(async item => {
		const uri: string | undefined = item.data?.uri;
		if (!uri) return item;
		const activeSel = features.completion?.getDocumentSelectionRequest
			? await connection.sendRequest(shared.GetEditorSelectionRequest.type)
			: undefined;
		const newPosition = activeSel?.textDocument.uri.toLowerCase() === uri.toLowerCase() ? activeSel.position : undefined;
		return projects.get(uri)?.service.doCompletionResolve(item, newPosition) ?? item;
	});
	connection.onHover(handler => {
		return projects
			.get(handler.textDocument.uri)?.service
			.doHover(handler.textDocument.uri, handler.position);
	});
	connection.onSignatureHelp(handler => {
		return projects
			.get(handler.textDocument.uri)?.service
			.getSignatureHelp(handler.textDocument.uri, handler.position, handler.context);
	});
	connection.onPrepareRename(handler => {
		return projects
			.get(handler.textDocument.uri)?.service
			.prepareRename(handler.textDocument.uri, handler.position);
	});
	connection.onRenameRequest(async handler => {
		return await projects
			.get(handler.textDocument.uri)?.service
			.doRename(handler.textDocument.uri, handler.position, handler.newName);
	});
	connection.onCodeLens(handler => {
		return projects
			.get(handler.textDocument.uri)?.service
			.getCodeLens(handler.textDocument.uri);
	});
	connection.onCodeLensResolve(codeLens => {
		const uri = codeLens.data?.uri;
		return projects
			.get(uri)?.service
			.doCodeLensResolve(codeLens, typeof features.codeLens === 'object' && features.codeLens.showReferencesNotification) ?? codeLens;
	});
	connection.onExecuteCommand(handler => {
		const uri = handler.arguments?.[0];
		return projects
			.get(uri)?.service
			.__internal__.executeCommand(uri, handler.command, handler.arguments, connection);
	});
	connection.onCodeAction(async handler => {
		const uri = handler.textDocument.uri;
		const project = projects.get(uri);
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
		const project = uri ? projects.get(uri) : undefined;
		if (project) {
			return await project.service.doCodeActionResolve(codeAction);
		}
		return codeAction;
	});
	connection.onReferences(async handler => {
		const result = await projects
			.get(handler.textDocument.uri)?.service
			.findReferences(handler.textDocument.uri, handler.position);
		if (result && documents.get(handler.textDocument.uri)?.languageId !== 'vue') {
			return result.filter(loc => loc.uri.endsWith('.vue'));
		}
		return result;
	});
	connection.onDefinition(async handler => {
		const result = await projects
			.get(handler.textDocument.uri)?.service
			.findDefinition(handler.textDocument.uri, handler.position);
		if (result && documents.get(handler.textDocument.uri)?.languageId !== 'vue') {
			return (result as (vscode.Location | vscode.LocationLink)[]).filter(loc => {
				if (vscode.Location.is(loc))
					return loc.uri.endsWith('.vue');
				else
					return loc.targetUri.endsWith('.vue');
			}) as vscode.Location[] | vscode.LocationLink[];
		}
		return result;
	});
	connection.onTypeDefinition(handler => {
		return projects
			.get(handler.textDocument.uri)?.service
			.findTypeDefinition(handler.textDocument.uri, handler.position);
	});
	connection.onDocumentHighlight(handler => {
		return projects
			.get(handler.textDocument.uri)?.service
			.findDocumentHighlights(handler.textDocument.uri, handler.position);
	});
	connection.onDocumentLinks(async handler => {
		return await projects
			.get(handler.textDocument.uri)?.service
			.findDocumentLinks(handler.textDocument.uri);
	});
	connection.languages.callHierarchy.onPrepare(async handler => {
		const items = await projects
			.get(handler.textDocument.uri)?.service
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
		return projects
			.get(uri)?.service
			.callHierarchy.getIncomingCalls(handler.item) ?? [];
	});
	connection.languages.callHierarchy.onOutgoingCalls(handler => {
		const data = handler.item.data as { __uri?: string } | undefined;
		const uri = data?.__uri ?? handler.item.uri;
		return projects
			.get(uri)?.service
			.callHierarchy.getOutgoingCalls(handler.item) ?? [];
	});
	connection.languages.semanticTokens.on(async (handler, token, _, resultProgress) => {
		const result = await projects
			.get(handler.textDocument.uri)?.service
			.getSemanticTokens(handler.textDocument.uri, undefined, token, resultProgress);
		return {
			resultId: result?.resultId,
			data: result?.data ?? [],
		};
	});
	connection.languages.semanticTokens.onRange(async (handler, token, _, resultProgress) => {
		const result = await projects
			.get(handler.textDocument.uri)?.service
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
					return await projects.get(file.oldUri)?.service.getEditsForFileRename(file.oldUri, file.newUri);
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
