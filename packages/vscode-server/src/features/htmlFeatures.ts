import { TagCloseRequest } from '@volar/shared';
import { NoStateLanguageService } from '@volar/vscode-vue-languageservice';
import { TextDocument } from 'vscode-css-languageservice';
import { Connection, TextDocuments } from 'vscode-languageserver/node';

export function register(
    connection: Connection,
    documents: TextDocuments<TextDocument>,
    noStateLs: NoStateLanguageService,
) {
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
    connection.languages.onLinkedEditingRange(handler => {
        if (!noStateLs) return;
        const document = documents.get(handler.textDocument.uri);
        if (!document) return;
        return noStateLs.findLinkedEditingRanges(document, handler.position);
    });
    connection.onRequest(TagCloseRequest.type, handler => {
        if (!noStateLs) return;
        const document = documents.get(handler.textDocument.uri);
        if (!document) return;
        return noStateLs.doAutoClose(document, handler.position);
    });
}
