import {
    CodeActionKind,
    CodeActionRequest,
    CodeLensRequest,
    Connection,
    DocumentColorRequest,
    DocumentHighlightRequest,
    DocumentLinkRequest,
    DocumentSymbolRequest
} from 'vscode-languageserver/node';
import {
    allFilesReg,
    vueFileReg
} from '../features/shared';

export function register(connection: Connection) {
    connection.client.register(DocumentHighlightRequest.type, vueFileReg);
    connection.client.register(DocumentSymbolRequest.type, vueFileReg);
    connection.client.register(DocumentLinkRequest.type, vueFileReg);
    connection.client.register(DocumentColorRequest.type, vueFileReg);
    connection.client.register(CodeLensRequest.type, {
        documentSelector: allFilesReg.documentSelector,
        resolveProvider: true,
    });
    connection.client.register(CodeActionRequest.type, {
        documentSelector: vueFileReg.documentSelector,
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
}
