import * as shared from '@volar/shared';
import * as vue from 'vscode-vue-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver';
import type { ServicesManager } from '../servicesManager';

export function register(
	connection: vscode.Connection,
	documents: vscode.TextDocuments<TextDocument>,
	servicesManager: ServicesManager,
	enableFindReferencesInTsScript: boolean,
) {
	connection.onCompletion(async handler => {
		return servicesManager
			.getMatchService(handler.textDocument.uri)
			?.doComplete(
				handler.textDocument.uri,
				handler.position,
				handler.context,
				{
					tag: () => connection.sendRequest(shared.GetClientTarNameCaseRequest.type, {
						uri: handler.textDocument.uri
					}),
					attr: () => connection.sendRequest(shared.GetClientAttrNameCaseRequest.type, {
						uri: handler.textDocument.uri
					}),
				},
			);
	});
	connection.onCompletionResolve(async item => {
		const uri: string | undefined = item.data?.uri;
		if (!uri) return item;
		const activeSel = await connection.sendRequest(shared.ActiveSelectionRequest.type);
		const newOffset = activeSel?.uri.toLowerCase() === uri.toLowerCase() ? activeSel?.offset : undefined;
		return servicesManager.getMatchService(uri)?.doCompletionResolve(item, newOffset) ?? item;
	});
	connection.onHover(handler => {
		return servicesManager
			.getMatchService(handler.textDocument.uri)
			?.doHover(handler.textDocument.uri, handler.position);
	});
	connection.onSignatureHelp(handler => {
		return servicesManager
			.getMatchService(handler.textDocument.uri)
			?.getSignatureHelp(handler.textDocument.uri, handler.position, handler.context);
	});
	connection.onSelectionRanges(handler => {
		return servicesManager
			.getMatchService(handler.textDocument.uri)
			?.getSelectionRanges(handler.textDocument.uri, handler.positions);
	});
	connection.onPrepareRename(handler => {
		return servicesManager
			.getMatchService(handler.textDocument.uri)
			?.prepareRename(handler.textDocument.uri, handler.position);
	});
	connection.onRenameRequest(handler => {
		return servicesManager
			.getMatchService(handler.textDocument.uri)
			?.doRename(handler.textDocument.uri, handler.position, handler.newName);
	});
	connection.onCodeLens(handler => {
		return servicesManager
			.getMatchService(handler.textDocument.uri)
			?.getCodeLens(handler.textDocument.uri);
	});
	connection.onCodeLensResolve(codeLens => {
		const uri = codeLens.data?.uri;
		return servicesManager
			.getMatchService(uri)
			?.doCodeLensResolve(codeLens) ?? codeLens;
	});
	connection.onExecuteCommand(handler => {
		const uri = handler.arguments?.[0];
		return servicesManager
			.getMatchService(uri)
			?.__internal__.executeCommand(uri, handler.command, handler.arguments, connection);
	});
	connection.onCodeAction(async handler => {
		const uri = handler.textDocument.uri;
		const tsConfig = servicesManager.getMatchTsConfig(uri);
		const service = tsConfig ? servicesManager.services.get(tsConfig)?.getLanguageService() : undefined;
		if (service) {
			const codeActions = await service.getCodeActions(uri, handler.range, handler.context);
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
		const service = tsConfig ? servicesManager.services.get(tsConfig)?.getLanguageService() : undefined;
		if (service) {
			return service.doCodeActionResolve(codeAction);
		}
		return codeAction;
	});
	connection.onReferences(handler => {
		const result = servicesManager
			.getMatchService(handler.textDocument.uri)
			?.findReferences(handler.textDocument.uri, handler.position);
		if (result && enableFindReferencesInTsScript && documents.get(handler.textDocument.uri)?.languageId !== 'vue') {
			return result.filter(loc => loc.uri.endsWith('.vue'));
		}
		return result;
	});
	connection.onDefinition(handler => {
		const result = servicesManager
			.getMatchService(handler.textDocument.uri)
			?.findDefinition(handler.textDocument.uri, handler.position);
		if (result && enableFindReferencesInTsScript && documents.get(handler.textDocument.uri)?.languageId !== 'vue') {
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
		return servicesManager
			.getMatchService(handler.textDocument.uri)
			?.findTypeDefinition(handler.textDocument.uri, handler.position);
	});
	connection.onDocumentColor(handler => {
		return servicesManager
			.getMatchService(handler.textDocument.uri)
			?.findDocumentColors(handler.textDocument.uri);
	});
	connection.onColorPresentation(handler => {
		return servicesManager
			.getMatchService(handler.textDocument.uri)
			?.getColorPresentations(handler.textDocument.uri, handler.color, handler.range);
	});
	connection.onDocumentHighlight(handler => {
		return servicesManager
			.getMatchService(handler.textDocument.uri)
			?.findDocumentHighlights(handler.textDocument.uri, handler.position);
	});
	connection.onDocumentSymbol(handler => {
		return servicesManager
			.getMatchService(handler.textDocument.uri)
			?.findDocumentSymbols(handler.textDocument.uri);
	});
	connection.onDocumentLinks(handler => {
		return servicesManager
			.getMatchService(handler.textDocument.uri)
			?.findDocumentLinks(handler.textDocument.uri);
	});
	connection.languages.callHierarchy.onPrepare(handler => {
		const items = servicesManager
			.getMatchService(handler.textDocument.uri)
			?.callHierarchy.doPrepare(handler.textDocument.uri, handler.position);
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
		return servicesManager
			.getMatchService(uri)
			?.callHierarchy.getIncomingCalls(handler.item) ?? [];
	});
	connection.languages.callHierarchy.onOutgoingCalls(handler => {
		const data = handler.item.data as { __uri?: string } | undefined;
		const uri = data?.__uri ?? handler.item.uri;
		return servicesManager
			.getMatchService(uri)
			?.callHierarchy.getOutgoingCalls(handler.item) ?? [];
	});
	connection.languages.semanticTokens.on((handler, token, _, resultProgress) => {
		const result = servicesManager
			.getMatchService(handler.textDocument.uri)
			?.getSemanticTokens(handler.textDocument.uri, undefined, token, resultProgress);
		return {
			resultId: result?.resultId,
			data: result?.data ?? [],
		};
	});
	connection.languages.semanticTokens.onRange((handler, token, _, resultProgress) => {
		const result = servicesManager
			.getMatchService(handler.textDocument.uri)
			?.getSemanticTokens(handler.textDocument.uri, handler.range, token, resultProgress);
		return {
			resultId: result?.resultId,
			data: result?.data ?? [],
		};
	});
	connection.workspace.onWillRenameFiles(async handler => {
		const edits = (await Promise.all(handler.files
			.map(file => {
				return servicesManager.getMatchService(file.oldUri)?.getEditsForFileRename(file.oldUri, file.newUri);
			}))).filter(shared.notEmpty);
		if (edits.length) {
			const result = edits[0];
			vue.margeWorkspaceEdits(result, ...edits.slice(1));
			return result;
		}
		return null;
	});
}
