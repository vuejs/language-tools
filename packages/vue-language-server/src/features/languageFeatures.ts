import * as vue from '@volar/vue-language-service';
import * as vscode from 'vscode-languageserver';
import { AutoInsertRequest, FindFileReferenceRequest, GetEditorSelectionRequest, ShowReferencesNotification } from '../requests';
import { ServerInitializationOptions } from '../types';
import type { Workspaces } from '../utils/workspaces';

export function register(
	connection: vscode.Connection,
	projects: Workspaces,
	features: NonNullable<ServerInitializationOptions['languageFeatures']>,
	params: vscode.InitializeParams,
) {

	let lastCompleteUri: string;
	let lastCompleteLs: vue.LanguageService;
	let lastCodeLensLs: vue.LanguageService;
	let lastCodeActionLs: vue.LanguageService;
	let lastCallHierarchyLs: vue.LanguageService;

	connection.onCompletion(async handler => {
		return worker(handler.textDocument.uri, async vueLs => {
			lastCompleteUri = handler.textDocument.uri;
			lastCompleteLs = vueLs;
			const list = await vueLs.doComplete(
				handler.textDocument.uri,
				handler.position,
				handler.context,
			);
			if (list) {
				for (const item of list.items) {
					fixTextEdit(item);
				}
			}
			return list;
		});
	});
	connection.onCompletionResolve(async item => {
		if (lastCompleteUri && lastCompleteLs) {

			const activeSel = features.completion?.getDocumentSelectionRequest
				? await connection.sendRequest(GetEditorSelectionRequest.type)
				: undefined;
			const newPosition = activeSel?.textDocument.uri.toLowerCase() === lastCompleteUri.toLowerCase() ? activeSel.position : undefined;

			item = await lastCompleteLs.doCompletionResolve(item, newPosition);

			fixTextEdit(item);
		}
		return item;
	});
	connection.onHover(async handler => {
		return worker(handler.textDocument.uri, vueLs => {
			return vueLs.doHover(handler.textDocument.uri, handler.position);
		});
	});
	connection.onSignatureHelp(async handler => {
		return worker(handler.textDocument.uri, vueLs => {
			return vueLs.getSignatureHelp(handler.textDocument.uri, handler.position, handler.context);
		});
	});
	connection.onPrepareRename(async handler => {
		return worker(handler.textDocument.uri, vueLs => {
			return vueLs.prepareRename(handler.textDocument.uri, handler.position);
		});
	});
	connection.onRenameRequest(async handler => {
		return worker(handler.textDocument.uri, vueLs => {
			return vueLs.doRename(handler.textDocument.uri, handler.position, handler.newName);
		});
	});
	connection.onCodeLens(async handler => {
		return worker(handler.textDocument.uri, async vueLs => {
			lastCodeLensLs = vueLs;
			return vueLs.doCodeLens(handler.textDocument.uri);
		});
	});
	connection.onCodeLensResolve(async codeLens => {
		return await lastCodeLensLs?.doCodeLensResolve(codeLens) ?? codeLens;
	});
	connection.onExecuteCommand(async (handler, token, workDoneProgress) => {

		if (handler.command === vue.executePluginCommand) {

			const args = handler.arguments as vue.ExecutePluginCommandArgs | undefined;
			if (!args) {
				return;
			}

			return worker(args[0], vueLs => {
				return vueLs.doExecuteCommand(handler.command, args, {
					token,
					workDoneProgress,
					applyEdit: (paramOrEdit) => connection.workspace.applyEdit(paramOrEdit),
					showReferences: (params) => connection.sendNotification(ShowReferencesNotification.type, params),
				});
			});
		}

		if (handler.command === 'volar.server.convertTagNameCasing') {

			const args = handler.arguments as [string, 'kebab' | 'pascal'] | undefined;
			if (!args) {
				return;
			}

			return worker(args[0], vueLs => {
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
					showReferences: (params) => connection.sendNotification(ShowReferencesNotification.type, params),
				});
			});
		}
	});
	connection.onCodeAction(async handler => {
		return worker(handler.textDocument.uri, async vueLs => {
			lastCodeActionLs = vueLs;
			let codeActions = await vueLs.doCodeActions(handler.textDocument.uri, handler.range, handler.context) ?? [];
			for (const codeAction of codeActions) {
				if (codeAction.data && typeof codeAction.data === 'object') {
					(codeAction.data as any).uri = handler.textDocument.uri;
				}
				else {
					codeAction.data = { uri: handler.textDocument.uri };
				}
			}
			if (!params.capabilities.textDocument?.codeAction?.disabledSupport) {
				codeActions = codeActions.filter(codeAction => !codeAction.disabled);
			}
			return codeActions;
		});
	});
	connection.onCodeActionResolve(async codeAction => {
		return await lastCodeActionLs.doCodeActionResolve(codeAction) ?? codeAction;
	});
	connection.onReferences(async handler => {
		return worker(handler.textDocument.uri, vueLs => {
			return vueLs.findReferences(handler.textDocument.uri, handler.position);
		});
	});
	connection.onRequest(FindFileReferenceRequest.type, async handler => {
		return worker(handler.textDocument.uri, vueLs => {
			return vueLs.findFileReferences(handler.textDocument.uri);
		});
	});
	connection.onImplementation(async handler => {
		return worker(handler.textDocument.uri, vueLs => {
			return vueLs.findImplementations(handler.textDocument.uri, handler.position);
		});
	});
	connection.onDefinition(async handler => {
		return worker(handler.textDocument.uri, vueLs => {
			return vueLs.findDefinition(handler.textDocument.uri, handler.position);
		});
	});
	connection.onTypeDefinition(async handler => {
		return worker(handler.textDocument.uri, vueLs => {
			return vueLs.findTypeDefinition(handler.textDocument.uri, handler.position);
		});
	});
	connection.onDocumentHighlight(async handler => {
		return worker(handler.textDocument.uri, vueLs => {
			return vueLs.findDocumentHighlights(handler.textDocument.uri, handler.position);
		});
	});
	connection.onDocumentLinks(async handler => {
		return worker(handler.textDocument.uri, vueLs => {
			return vueLs.findDocumentLinks(handler.textDocument.uri);
		});
	});
	connection.onWorkspaceSymbol(async (handler, token) => {

		let results: vscode.SymbolInformation[] = [];

		for (const _workspace of projects.workspaces.values()) {
			const workspace = await _workspace;
			let projects = [...workspace.projects.values()];
			projects = projects.length ? projects : [workspace.getInferredProject()];
			for (const project of projects) {

				if (token.isCancellationRequested)
					return;

				const vueLs = (await project).getLanguageService();

				results = results.concat(await vueLs.findWorkspaceSymbols(handler.query));
			}
		}

		return results;
	});
	connection.languages.callHierarchy.onPrepare(async handler => {
		return await worker(handler.textDocument.uri, async vueLs => {
			lastCallHierarchyLs = vueLs;
			return vueLs.callHierarchy.doPrepare(handler.textDocument.uri, handler.position);
		}) ?? [];
	});
	connection.languages.callHierarchy.onIncomingCalls(async handler => {
		return await lastCallHierarchyLs?.callHierarchy.getIncomingCalls(handler.item) ?? [];
	});
	connection.languages.callHierarchy.onOutgoingCalls(async handler => {
		return await lastCallHierarchyLs?.callHierarchy.getOutgoingCalls(handler.item) ?? [];
	});
	connection.languages.semanticTokens.on(async (handler, token, _, resultProgress) => {
		return await worker(handler.textDocument.uri, async vueLs => {

			const result = await vueLs?.getSemanticTokens(
				handler.textDocument.uri,
				undefined,
				token,
				tokens => resultProgress?.report(buildTokens(tokens)),
			) ?? [];

			return buildTokens(result);
		}) ?? buildTokens([]);
	});
	connection.languages.semanticTokens.onRange(async (handler, token, _, resultProgress) => {
		return await worker(handler.textDocument.uri, async vueLs => {

			const result = await vueLs?.getSemanticTokens(
				handler.textDocument.uri,
				handler.range,
				token,
				tokens => resultProgress?.report(buildTokens(tokens)),
			) ?? [];

			return buildTokens(result);
		}) ?? buildTokens([]);
	});
	connection.languages.diagnostics.on(async (params, cancellationToken, workDoneProgressReporter, resultProgressReporter) => {
		const result = await worker(params.textDocument.uri, vueLs => {
			return vueLs.doValidation(params.textDocument.uri, errors => {
				// resultProgressReporter is undefined in vscode
				resultProgressReporter?.report({
					relatedDocuments: {
						[params.textDocument.uri]: {
							kind: vscode.DocumentDiagnosticReportKind.Full,
							items: errors,
						},
					},
				});
			}, cancellationToken);
		});
		return {
			kind: vscode.DocumentDiagnosticReportKind.Full,
			items: result ?? [],
		};
	});
	connection.languages.inlayHint.on(async handler => {
		return worker(handler.textDocument.uri, vueLs => {
			return vueLs.getInlayHints(handler.textDocument.uri, handler.range);
		});
	});
	// TODO: connection.languages.inlayHint.resolve
	connection.workspace.onWillRenameFiles(async handler => {

		const config = await connection.workspace.getConfiguration('volar.updateImportsOnFileMove.enabled');
		if (!config) {
			return null;
		}

		if (handler.files.length !== 1) {
			return null;
		}

		const file = handler.files[0];

		return await worker(file.oldUri, vueLs => {
			return vueLs.getEditsForFileRename(file.oldUri, file.newUri) ?? null;
		}) ?? null;
	});
	connection.onRequest(AutoInsertRequest.type, async handler => {
		return worker(handler.textDocument.uri, vueLs => {
			return vueLs.doAutoInsert(handler.textDocument.uri, handler.position, handler.options);
		});
	});

	async function worker<T>(uri: string, cb: (vueLs: vue.LanguageService) => T) {
		const vueLs = await getLanguageService(uri);
		if (vueLs) {
			return cb(vueLs);
		}
	}
	function buildTokens(tokens: vue.SemanticToken[]) {
		const builder = new vscode.SemanticTokensBuilder();
		const sortedTokens = tokens.sort((a, b) => a[0] - b[0] === 0 ? a[1] - b[1] : a[0] - b[0]);
		for (const token of sortedTokens) {
			builder.push(...token);
		}
		return builder.build();
	}
	async function getLanguageService(uri: string) {
		const project = (await projects.getProject(uri))?.project;
		return project?.getLanguageService();
	}
	function fixTextEdit(item: vscode.CompletionItem) {
		const insertReplaceSupport = params.capabilities.textDocument?.completion?.completionItem?.insertReplaceSupport ?? false;
		if (!insertReplaceSupport) {
			if (item.textEdit && vscode.InsertReplaceEdit.is(item.textEdit)) {
				item.textEdit = vscode.TextEdit.replace(item.textEdit.insert, item.textEdit.newText);
			}
		}
	}
}
