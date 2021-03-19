import { notEmpty } from '@volar/shared';
import { margeWorkspaceEdits } from '@volar/vscode-vue-languageservice';
import { getEmmetConfiguration } from '../configs';
import { connection, documents, host, noStateLs } from '../instances';

connection.onCompletion(async handler => {
    const document = documents.get(handler.textDocument.uri);
    if (!document) return;

    return host?.bestMatch(document.uri)?.doComplete(
        document,
        handler.position,
        handler.context,
        getEmmetConfiguration,
    );
});
connection.onCompletionResolve(async item => {
    const uri = item.data?.uri;
    return host?.bestMatch(uri)?.doCompletionResolve(item) ?? item;
});
connection.onHover(handler => {
    const document = documents.get(handler.textDocument.uri);
    if (!document) return;
    return host?.bestMatch(document.uri)?.doHover(document, handler.position);
});
connection.onSignatureHelp(handler => {
    const document = documents.get(handler.textDocument.uri);
    if (!document) return;
    return host?.bestMatch(document.uri)?.getSignatureHelp(document, handler.position);
});
connection.onSelectionRanges(handler => {
    const document = documents.get(handler.textDocument.uri);
    if (!document) return;
    return host?.bestMatch(document.uri)?.getSelectionRanges(document, handler.positions);
});
connection.onPrepareRename(handler => {
    return host?.bestMatch(handler.textDocument.uri)?.rename.onPrepare(handler.textDocument.uri, handler.position);
});
connection.onRenameRequest(handler => {
    return host?.bestMatch(handler.textDocument.uri)?.rename.doRename(handler.textDocument.uri, handler.position, handler.newName);
});
connection.onCodeLens(handler => {
    const document = documents.get(handler.textDocument.uri);
    if (!document) return;
    return host?.bestMatch(document.uri)?.getCodeLens(document);
});
connection.onCodeLensResolve(codeLens => {
    if (!host) return codeLens;
    const uri = codeLens.data?.uri;
    return host?.bestMatch(uri)?.doCodeLensResolve(codeLens) ?? codeLens;
});
connection.onExecuteCommand(handler => {
    const uri = handler.arguments?.[0];
    const document = documents.get(uri);
    if (!document) return;
    return host?.bestMatch(uri)?.doExecuteCommand(document, handler.command, handler.arguments, connection);
});
connection.onCodeAction(handler => {
    const uri = handler.textDocument.uri;
    const tsConfig = host?.bestMatchTsConfig(uri);
    const service = tsConfig ? host?.services.get(tsConfig)?.getLanguageService() : undefined;
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
    if (!host) return codeAction;
    const tsConfig: string | undefined = (codeAction.data as any)?.tsConfig;
    const service = tsConfig ? host.services.get(tsConfig)?.getLanguageService() : undefined;
    if (service) {
        return service.doCodeActionResolve(codeAction);
    }
    return codeAction;
});
connection.onReferences(handler => {
    const document = documents.get(handler.textDocument.uri);
    if (!document) return;
    return host?.bestMatch(document.uri)?.findReferences(document.uri, handler.position);
});
connection.onDefinition(handler => {
    const document = documents.get(handler.textDocument.uri);
    if (!document) return;
    return host?.bestMatch(document.uri)?.findDefinition(document.uri, handler.position);
});
connection.onTypeDefinition(handler => {
    const document = documents.get(handler.textDocument.uri);
    if (!document) return;
    return host?.bestMatch(document.uri)?.findTypeDefinition(document.uri, handler.position);
});
connection.onDocumentColor(handler => {
    const document = documents.get(handler.textDocument.uri);
    if (!document) return;
    return host?.bestMatch(document.uri)?.findDocumentColors(document);
});
connection.onColorPresentation(handler => {
    const document = documents.get(handler.textDocument.uri);
    if (!document) return;
    return host?.bestMatch(document.uri)?.getColorPresentations(document, handler.color, handler.range);
});
connection.onDocumentHighlight(handler => {
    const document = documents.get(handler.textDocument.uri);
    if (!document) return;
    return host?.bestMatch(document.uri)?.findDocumentHighlights(document, handler.position);
});
connection.onDocumentSymbol(handler => {
    const document = documents.get(handler.textDocument.uri);
    if (!document) return;
    return host?.bestMatch(document.uri)?.findDocumentSymbols(document);
});
connection.onDocumentLinks(handler => {
    const document = documents.get(handler.textDocument.uri);
    if (!document) return;
    return host?.bestMatch(document.uri)?.findDocumentLinks(document);
});
connection.onDocumentFormatting(handler => {
    if (!noStateLs) return;
    const document = documents.get(handler.textDocument.uri);
    if (!document) return;
    return noStateLs.doFormatting(document, handler.options);
});
connection.onFoldingRanges(handler => {
    if (!noStateLs) return;
    const document = documents.get(handler.textDocument.uri);
    if (!document) return;
    return noStateLs.getFoldingRanges(document);
});
connection.languages.callHierarchy.onPrepare(handler => {
    if (!host) return [];
    const document = documents.get(handler.textDocument.uri);
    if (!document) return [];
    const items = host?.bestMatch(document.uri)?.callHierarchy.onPrepare(document, handler.position);
    return items?.length ? items : null;
});
connection.languages.callHierarchy.onIncomingCalls(handler => {
    if (!host) return [];
    const { uri } = handler.item.data as { uri: string };
    return host?.bestMatch(uri)?.callHierarchy.onIncomingCalls(handler.item) ?? [];
});
connection.languages.callHierarchy.onOutgoingCalls(handler => {
    if (!host) return [];
    const { uri } = handler.item.data as { uri: string };
    return host?.bestMatch(uri)?.callHierarchy.onOutgoingCalls(handler.item) ?? [];
});
connection.languages.onLinkedEditingRange(handler => {
    if (!noStateLs) return;
    const document = documents.get(handler.textDocument.uri);
    if (!document) return;
    return noStateLs.findLinkedEditingRanges(document, handler.position);
});
connection.workspace.onWillRenameFiles(handler => {
    if (!host) return null;
    const edits = handler.files
        .map(file => {
            return host?.bestMatch(file.oldUri)?.rename.onRenameFile(file.oldUri, file.newUri);
        })
        .filter(notEmpty)

    if (edits.length) {
        const result = edits[0];
        margeWorkspaceEdits(result, ...edits.slice(1));
        return result;
    }

    return null;
});
