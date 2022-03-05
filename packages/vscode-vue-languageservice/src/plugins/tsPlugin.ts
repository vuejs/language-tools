import { TextDocument } from 'vscode-languageserver-textdocument';
import { definePlugin } from './definePlugin';
import * as ts2 from 'vscode-typescript-languageservice';

export default definePlugin((host: {
    typescript: typeof import('typescript/lib/tsserverlibrary'),
    tsLs: ts2.LanguageService,
    baseCompletionOptions: ts.GetCompletionsAtPositionOptions,
}) => {

    return {

        triggerCharacters: ts2.getTriggerCharacters(host.typescript.version),

        doValidation(document, options) {
            if (isTsDocument(document)) {
                return host.tsLs.doValidation(document.uri, options);
            }
        },

        doComplete(document, position, context) {
            if (isTsDocument(document)) {
                const options: ts.GetCompletionsAtPositionOptions = {
                    ...host.baseCompletionOptions,
                    triggerCharacter: context?.triggerCharacter as ts.CompletionsTriggerCharacter,
                    triggerKind: context?.triggerKind,
                };

                return host.tsLs.doComplete(document.uri, position, options);
            }
        },

        doCompleteResolve(item) {
            return host.tsLs.doCompletionResolve(item);
        },

        doHover(document, position) {
            if (isTsDocument(document)) {
                return host.tsLs.doHover(document.uri, position);
            }
        },

        findDefinition(document, position) {
            if (isTsDocument(document)) {
                return host.tsLs.findDefinition(document.uri, position);
            }
        },

        findTypeDefinition(document, position) {
            if (isTsDocument(document)) {
                return host.tsLs.findTypeDefinition(document.uri, position);
            }
        },

        findReferences(document, position) {
            if (isTsDocument(document) || isJsonDocument(document)) {
                return host.tsLs.findReferences(document.uri, position);
            }
        },

        findDocumentHighlights(document, position) {
            if (isTsDocument(document)) {
                return host.tsLs.findDocumentHighlights(document.uri, position);
            }
        },

        findDocumentSymbols(document) {
            if (isTsDocument(document)) {
                return host.tsLs.findDocumentSymbols(document.uri);
            }
        },

        findDocumentSemanticTokens(document, range, cancleToken) {
            if (isTsDocument(document)) {
                return host.tsLs.getDocumentSemanticTokens(document.uri, range, cancleToken);
            }
        },

        findWorkspaceSymbols(query) {
            return host.tsLs.findWorkspaceSymbols(query);
        },

        doCodeActions(document, range, context) {
            if (isTsDocument(document)) {
                return host.tsLs.getCodeActions(document.uri, range, context);
            }
        },

        doRenamePrepare(document, position) {
            if (isTsDocument(document)) {
                return host.tsLs.prepareRename(document.uri, position);
            }
        },

        doRename(document, position, newName) {
            if (isTsDocument(document) || isJsonDocument(document)) {
                return host.tsLs.doRename(document.uri, position, newName);
            }
        },

        getEditsForFileRename(oldUri, newUri) {
            return host.tsLs.getEditsForFileRename(oldUri, newUri);
        },

        getFoldingRanges(document) {
            if (isTsDocument(document)) {
                return host.tsLs.getFoldingRanges(document.uri);
            }
        },

        getSelectionRanges(document, positions) {
            if (isTsDocument(document)) {
                return host.tsLs.getSelectionRanges(document.uri, positions);
            }
        },

        getSignatureHelp(document, position, context) {
            if (isTsDocument(document)) {
                return host.tsLs.getSignatureHelp(document.uri, position, context);
            }
        },

        format(document, range, options) {
            if (isTsDocument(document)) {
                return host.tsLs.doFormatting(document.uri, options, range);
            }
        },

        callHierarchy: {

            doPrepare(document, position) {
                if (isTsDocument(document)) {
                    return host.tsLs.callHierarchy.doPrepare(document.uri, position);
                }
            },

            getIncomingCalls(item) {
                return host.tsLs.callHierarchy.getIncomingCalls(item);
            },

            getOutgoingCalls(item) {
                return host.tsLs.callHierarchy.getOutgoingCalls(item);
            },
        },
    };
});


export function isTsDocument(document: TextDocument) {
    return document.languageId === 'javascript' ||
        document.languageId === 'typescript' ||
        document.languageId === 'javascriptreact' ||
        document.languageId === 'typescriptreact'
}

export function isJsonDocument(document: TextDocument) {
    return document.languageId === 'json';
}
