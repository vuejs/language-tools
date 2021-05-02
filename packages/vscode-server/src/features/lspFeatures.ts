import { ActiveSelectionRequest, GetClientNameCasesRequest, notEmpty } from '@volar/shared';
import { margeWorkspaceEdits } from '@volar/vscode-vue-languageservice';
import { TextDocument } from 'vscode-css-languageservice';
import { Connection, TextDocuments } from 'vscode-languageserver/node';
import { getEmmetConfiguration } from '../configs';
import type { ServicesManager } from '../servicesManager';

export function register(
    connection: Connection,
    documents: TextDocuments<TextDocument>,
    servicesManager: ServicesManager,
    enabledTsPlugin: boolean,
) {
    connection.onCompletion(async handler => {
        const document = documents.get(handler.textDocument.uri);
        if (!document) return;

        return servicesManager.getMatchService(document.uri)?.doComplete(
            document.uri,
            handler.position,
            handler.context,
            getEmmetConfiguration,
            () => connection.sendRequest(GetClientNameCasesRequest.type, {
                uri: handler.textDocument.uri
            }),
        );
    });
    connection.onCompletionResolve(async item => {
        const uri: string | undefined = item.data?.uri;
        if (!uri) return item;
        const activeSel = await connection.sendRequest(ActiveSelectionRequest.type);
        const newOffset = activeSel?.uri.toLowerCase() === uri.toLowerCase() ? activeSel?.offset : undefined;
        return servicesManager.getMatchService(uri)?.doCompletionResolve(item, newOffset) ?? item;
    });
    connection.onHover(handler => {
        const document = documents.get(handler.textDocument.uri);
        if (!document) return;
        return servicesManager.getMatchService(document.uri)?.doHover(document.uri, handler.position);
    });
    connection.onSignatureHelp(handler => {
        const document = documents.get(handler.textDocument.uri);
        if (!document) return;
        return servicesManager.getMatchService(document.uri)?.getSignatureHelp(document, handler.position);
    });
    connection.onSelectionRanges(handler => {
        const document = documents.get(handler.textDocument.uri);
        if (!document) return;
        return servicesManager.getMatchService(document.uri)?.getSelectionRanges(document, handler.positions);
    });
    connection.onPrepareRename(handler => {
        return servicesManager.getMatchService(handler.textDocument.uri)?.prepareRename(handler.textDocument.uri, handler.position);
    });
    connection.onRenameRequest(handler => {
        return servicesManager.getMatchService(handler.textDocument.uri)?.doRename(handler.textDocument.uri, handler.position, handler.newName);
    });
    connection.onCodeLens(handler => {
        const document = documents.get(handler.textDocument.uri);
        if (!document) return;
        return servicesManager.getMatchService(document.uri)?.getCodeLens(document);
    });
    connection.onCodeLensResolve(codeLens => {
        const uri = codeLens.data?.uri;
        return servicesManager.getMatchService(uri)?.doCodeLensResolve(codeLens) ?? codeLens;
    });
    connection.onExecuteCommand(handler => {
        const uri = handler.arguments?.[0];
        const document = documents.get(uri);
        if (!document) return;
        return servicesManager.getMatchService(uri)?.__internal__.executeCommand(document, handler.command, handler.arguments, connection);
    });
    connection.onCodeAction(handler => {
        const uri = handler.textDocument.uri;
        const tsConfig = servicesManager.getMatchTsConfig(uri);
        const service = tsConfig ? servicesManager.services.get(tsConfig)?.getLanguageService() : undefined;
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
        const service = tsConfig ? servicesManager.services.get(tsConfig)?.getLanguageService() : undefined;
        if (service) {
            return service.doCodeActionResolve(codeAction);
        }
        return codeAction;
    });
    connection.onReferences(handler => {
        const document = documents.get(handler.textDocument.uri);
        if (!document) return;
        const result = servicesManager.getMatchService(document.uri)?.findReferences(document.uri, handler.position);
        if (enabledTsPlugin && document.languageId !== 'vue') {
            return result?.filter(loc => loc.uri.endsWith('.vue'));
        }
        return result;
    });
    connection.onDefinition(handler => {
        const document = documents.get(handler.textDocument.uri);
        if (!document) return;
        return servicesManager.getMatchService(document.uri)?.findDefinition(document.uri, handler.position);
    });
    connection.onTypeDefinition(handler => {
        const document = documents.get(handler.textDocument.uri);
        if (!document) return;
        return servicesManager.getMatchService(document.uri)?.findTypeDefinition(document.uri, handler.position);
    });
    connection.onDocumentColor(handler => {
        const document = documents.get(handler.textDocument.uri);
        if (!document) return;
        return servicesManager.getMatchService(document.uri)?.findDocumentColors(document);
    });
    connection.onColorPresentation(handler => {
        const document = documents.get(handler.textDocument.uri);
        if (!document) return;
        return servicesManager.getMatchService(document.uri)?.getColorPresentations(document, handler.color, handler.range);
    });
    connection.onDocumentHighlight(handler => {
        const document = documents.get(handler.textDocument.uri);
        if (!document) return;
        return servicesManager.getMatchService(document.uri)?.findDocumentHighlights(document, handler.position);
    });
    connection.onDocumentSymbol(handler => {
        const document = documents.get(handler.textDocument.uri);
        if (!document) return;
        return servicesManager.getMatchService(document.uri)?.findDocumentSymbols(document);
    });
    connection.onDocumentLinks(handler => {
        const document = documents.get(handler.textDocument.uri);
        if (!document) return;
        return servicesManager.getMatchService(document.uri)?.findDocumentLinks(document);
    });
    connection.languages.callHierarchy.onPrepare(handler => {
        const document = documents.get(handler.textDocument.uri);
        if (!document) return [];
        const items = servicesManager.getMatchService(document.uri)?.callHierarchy.doPrepare(document, handler.position);
        return items?.length ? items : null;
    });
    connection.languages.callHierarchy.onIncomingCalls(handler => {
        const { uri } = handler.item.data as { uri: string };
        return servicesManager.getMatchService(uri)?.callHierarchy.getIncomingCalls(handler.item) ?? [];
    });
    connection.languages.callHierarchy.onOutgoingCalls(handler => {
        const { uri } = handler.item.data as { uri: string };
        return servicesManager.getMatchService(uri)?.callHierarchy.getOutgoingCalls(handler.item) ?? [];
    });
    connection.workspace.onWillRenameFiles(handler => {
        const edits = handler.files
            .map(file => {
                return servicesManager.getMatchService(file.oldUri)?.getEditsForFileRename(file.oldUri, file.newUri);
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
