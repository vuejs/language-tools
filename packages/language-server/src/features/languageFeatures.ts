import * as embedded from '@volar/language-service';
import * as vscode from 'vscode-languageserver';
import { AutoInsertRequest, FindFileReferenceRequest, ShowReferencesNotification } from '../protocol';
import { CancellactionTokenHost } from '../utils/cancellationPipe';
import type { Workspaces } from '../utils/workspaces';
import * as shared from '@volar/shared';

export function register(
	connection: vscode.Connection,
	projects: Workspaces,
	initParams: vscode.InitializeParams,
	cancelHost: CancellactionTokenHost,
) {

	let lastCompleteUri: string;
	let lastCompleteLs: embedded.LanguageService;
	let lastCodeLensLs: embedded.LanguageService;
	let lastCodeActionLs: embedded.LanguageService;
	let lastCallHierarchyLs: embedded.LanguageService;

	connection.onCompletion(async (params) => {
		return worker(params.textDocument.uri, async vueLs => {
			lastCompleteUri = params.textDocument.uri;
			lastCompleteLs = vueLs;
			const list = await vueLs.doComplete(
				params.textDocument.uri,
				params.position,
				params.context,
			);
			if (list) {
				for (const item of list.items) {
					fixTextEdit(item);
				}
			}
			return list;
		});
	});
	connection.onCompletionResolve(async (item) => {
		if (lastCompleteUri && lastCompleteLs) {
			item = await lastCompleteLs.doCompletionResolve(item);
			fixTextEdit(item);
		}
		return item;
	});
	connection.onHover(async (params) => {
		return worker(params.textDocument.uri, vueLs => {
			return vueLs.doHover(params.textDocument.uri, params.position);
		});
	});
	connection.onSignatureHelp(async (params) => {
		return worker(params.textDocument.uri, vueLs => {
			return vueLs.getSignatureHelp(params.textDocument.uri, params.position, params.context);
		});
	});
	connection.onPrepareRename(async (params) => {
		return worker(params.textDocument.uri, vueLs => {
			return vueLs.prepareRename(params.textDocument.uri, params.position);
		});
	});
	connection.onRenameRequest(async (params) => {
		return worker(params.textDocument.uri, vueLs => {
			return vueLs.doRename(params.textDocument.uri, params.position, params.newName);
		});
	});
	connection.onCodeLens(async (params) => {
		return worker(params.textDocument.uri, async vueLs => {
			lastCodeLensLs = vueLs;
			return vueLs.doCodeLens(params.textDocument.uri);
		});
	});
	connection.onCodeLensResolve(async (codeLens) => {
		return await lastCodeLensLs?.doCodeLensResolve(codeLens) ?? codeLens;
	});
	connection.onExecuteCommand(async (params, token, workDoneProgress) => {
		if (params.command === embedded.executePluginCommand) {

			const args = params.arguments as embedded.ExecutePluginCommandArgs | undefined;
			if (!args) {
				return;
			}

			return worker(args[0], vueLs => {
				return vueLs.doExecuteCommand(params.command, args, {
					token,
					workDoneProgress,
					applyEdit: (paramOrEdit) => connection.workspace.applyEdit(paramOrEdit),
					showReferences: (params) => connection.sendNotification(ShowReferencesNotification.type, params),
				});
			});
		}
	});
	connection.onCodeAction(async (params) => {
		return worker(params.textDocument.uri, async vueLs => {
			lastCodeActionLs = vueLs;
			let codeActions = await vueLs.doCodeActions(params.textDocument.uri, params.range, params.context) ?? [];
			for (const codeAction of codeActions) {
				if (codeAction.data && typeof codeAction.data === 'object') {
					(codeAction.data as any).uri = params.textDocument.uri;
				}
				else {
					codeAction.data = { uri: params.textDocument.uri };
				}
			}
			if (!initParams.capabilities.textDocument?.codeAction?.disabledSupport) {
				codeActions = codeActions.filter(codeAction => !codeAction.disabled);
			}
			return codeActions;
		});
	});
	connection.onCodeActionResolve(async (codeAction) => {
		return await lastCodeActionLs.doCodeActionResolve(codeAction) ?? codeAction;
	});
	connection.onReferences(async (params) => {
		return worker(params.textDocument.uri, vueLs => {
			return vueLs.findReferences(params.textDocument.uri, params.position);
		});
	});
	connection.onRequest(FindFileReferenceRequest.type, async (params) => {
		return worker(params.textDocument.uri, vueLs => {
			return vueLs.findFileReferences(params.textDocument.uri);
		});
	});
	connection.onImplementation(async (params) => {
		return worker(params.textDocument.uri, vueLs => {
			return vueLs.findImplementations(params.textDocument.uri, params.position);
		});
	});
	connection.onDefinition(async (params) => {
		return worker(params.textDocument.uri, vueLs => {
			return vueLs.findDefinition(params.textDocument.uri, params.position);
		});
	});
	connection.onTypeDefinition(async (params) => {
		return worker(params.textDocument.uri, vueLs => {
			return vueLs.findTypeDefinition(params.textDocument.uri, params.position);
		});
	});
	connection.onDocumentHighlight(async (params) => {
		return worker(params.textDocument.uri, vueLs => {
			return vueLs.findDocumentHighlights(params.textDocument.uri, params.position);
		});
	});
	connection.onDocumentLinks(async (params) => {
		return worker(params.textDocument.uri, vueLs => {
			return vueLs.findDocumentLinks(params.textDocument.uri);
		});
	});
	connection.onWorkspaceSymbol(async (params, token) => {


		let results: vscode.SymbolInformation[] = [];

		for (const _workspace of projects.workspaces.values()) {
			const workspace = await _workspace;
			let projects = [...workspace.projects.values()];
			projects = projects.length ? projects : [workspace.getInferredProject()];
			for (const project of projects) {

				if (token.isCancellationRequested)
					return;

				const vueLs = (await project).getLanguageService();

				results = results.concat(await vueLs.findWorkspaceSymbols(params.query));
			}
		}

		return results;
	});
	connection.languages.callHierarchy.onPrepare(async (params) => {
		return await worker(params.textDocument.uri, async vueLs => {
			lastCallHierarchyLs = vueLs;
			return vueLs.callHierarchy.doPrepare(params.textDocument.uri, params.position);
		}) ?? [];
	});
	connection.languages.callHierarchy.onIncomingCalls(async (params) => {
		return await lastCallHierarchyLs?.callHierarchy.getIncomingCalls(params.item) ?? [];
	});
	connection.languages.callHierarchy.onOutgoingCalls(async (params) => {
		return await lastCallHierarchyLs?.callHierarchy.getOutgoingCalls(params.item) ?? [];
	});
	connection.languages.semanticTokens.on(async (params, token, _, resultProgress) => {
		await shared.sleep(200);
		if (token.isCancellationRequested) return buildTokens([]);
		return await worker(params.textDocument.uri, async vueLs => {

			const result = await vueLs?.getSemanticTokens(
				params.textDocument.uri,
				undefined,
				token,
				tokens => resultProgress?.report(buildTokens(tokens)),
			) ?? [];

			return buildTokens(result);
		}) ?? buildTokens([]);
	});
	connection.languages.semanticTokens.onRange(async (params, token, _, resultProgress) => {
		await shared.sleep(200);
		if (token.isCancellationRequested) return buildTokens([]);
		return await worker(params.textDocument.uri, async vueLs => {

			const result = await vueLs?.getSemanticTokens(
				params.textDocument.uri,
				params.range,
				token,
				tokens => resultProgress?.report(buildTokens(tokens)),
			) ?? [];

			return buildTokens(result);
		}) ?? buildTokens([]);
	});
	connection.languages.diagnostics.on(async (params, token, workDoneProgressReporter, resultProgressReporter) => {
		token = cancelHost.createCancellactionToken(token);
		const result = await worker(params.textDocument.uri, vueLs => {
			return vueLs.doValidation(params.textDocument.uri, token, errors => {
				// resultProgressReporter is undefined in vscode
				resultProgressReporter?.report({
					relatedDocuments: {
						[params.textDocument.uri]: {
							kind: vscode.DocumentDiagnosticReportKind.Full,
							items: errors,
						},
					},
				});
			});
		});
		return {
			kind: vscode.DocumentDiagnosticReportKind.Full,
			items: result ?? [],
		};
	});
	connection.languages.inlayHint.on(async params => {
		return worker(params.textDocument.uri, async vueLs => {
			return vueLs.getInlayHints(params.textDocument.uri, params.range);
		});
	});
	// TODO: connection.languages.inlayHint.resolve
	connection.workspace.onWillRenameFiles(async params => {

		const config = await connection.workspace.getConfiguration('volar.updateImportsOnFileMove.enabled');
		if (!config) {
			return null;
		}

		if (params.files.length !== 1) {
			return null;
		}

		const file = params.files[0];

		return await worker(file.oldUri, vueLs => {
			return vueLs.getEditsForFileRename(file.oldUri, file.newUri) ?? null;
		}) ?? null;
	});
	connection.onRequest(AutoInsertRequest.type, async params => {
		return worker(params.textDocument.uri, vueLs => {
			return vueLs.doAutoInsert(params.textDocument.uri, params.position, params.options);
		});
	});

	async function worker<T>(uri: string, cb: (vueLs: embedded.LanguageService) => T) {
		const vueLs = await getLanguageService(uri);
		if (vueLs) {
			try {
				return cb(vueLs); // handle for TS cancel throw
			}
			catch {
				return undefined;
			}
		}
	}
	function buildTokens(tokens: embedded.SemanticToken[]) {
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
		const insertReplaceSupport = initParams.capabilities.textDocument?.completion?.completionItem?.insertReplaceSupport ?? false;
		if (!insertReplaceSupport) {
			if (item.textEdit && vscode.InsertReplaceEdit.is(item.textEdit)) {
				item.textEdit = vscode.TextEdit.replace(item.textEdit.insert, item.textEdit.newText);
			}
		}
	}
}
