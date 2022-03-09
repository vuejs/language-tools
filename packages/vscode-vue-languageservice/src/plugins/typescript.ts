import { TextDocument } from 'vscode-languageserver-textdocument';
import { definePlugin } from '../utils/definePlugin';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as ts2 from 'vscode-typescript-languageservice';

export { getSemanticTokenLegend, getTriggerCharacters } from 'vscode-typescript-languageservice';

export default definePlugin((host: {
    getTsLs: () => ts2.LanguageService,
    baseCompletionOptions?: ts.GetCompletionsAtPositionOptions,
}) => {

    return {

        doValidation(document, options) {
            if (isTsDocument(document)) {
                return host.getTsLs().doValidation(document.uri, options);
            }
        },

        doComplete(document, position, context) {
            if (isTsDocument(document)) {
                const options: ts.GetCompletionsAtPositionOptions = {
                    ...host.baseCompletionOptions,
                    triggerCharacter: context?.triggerCharacter as ts.CompletionsTriggerCharacter,
                    triggerKind: context?.triggerKind,
                };

                return host.getTsLs().doComplete(document.uri, position, options);
            }
        },

        doCompleteResolve(item) {
            return host.getTsLs().doCompletionResolve(item);
        },

        doHover(document, position) {
            if (isTsDocument(document)) {
                return host.getTsLs().doHover(document.uri, position);
            }
        },

        findDefinition(document, position) {
            if (isTsDocument(document)) {
                return host.getTsLs().findDefinition(document.uri, position);
            }
        },

        findTypeDefinition(document, position) {
            if (isTsDocument(document)) {
                return host.getTsLs().findTypeDefinition(document.uri, position);
            }
        },

        findImplementations(document, position) {
            if (isTsDocument(document)) {
                return host.getTsLs().findImplementations(document.uri, position);
            }
        },

        findReferences(document, position) {
            if (isTsDocument(document) || isJsonDocument(document)) {
                return host.getTsLs().findReferences(document.uri, position);
            }
        },

        findDocumentHighlights(document, position) {
            if (isTsDocument(document)) {
                return host.getTsLs().findDocumentHighlights(document.uri, position);
            }
        },

        findDocumentSymbols(document) {
            if (isTsDocument(document)) {
                return host.getTsLs().findDocumentSymbols(document.uri);
            }
        },

        findDocumentSemanticTokens(document, range, cancleToken) {
            if (isTsDocument(document)) {
                return host.getTsLs().getDocumentSemanticTokens(document.uri, range, cancleToken);
            }
        },

        findWorkspaceSymbols(query) {
            return host.getTsLs().findWorkspaceSymbols(query);
        },

        doCodeActions(document, range, context) {
            if (isTsDocument(document)) {
                return host.getTsLs().getCodeActions(document.uri, range, context);
            }
        },

        doCodeActionResolve(codeAction) {
            return host.getTsLs().doCodeActionResolve(codeAction);
        },

        doRenamePrepare(document, position) {
            if (isTsDocument(document)) {
                return host.getTsLs().prepareRename(document.uri, position);
            }
        },

        doRename(document, position, newName) {
            if (isTsDocument(document) || isJsonDocument(document)) {
                return host.getTsLs().doRename(document.uri, position, newName);
            }
        },

        doFileRename(oldUri, newUri) {
            return host.getTsLs().getEditsForFileRename(oldUri, newUri);
        },

        getFoldingRanges(document) {
            if (isTsDocument(document)) {
                return host.getTsLs().getFoldingRanges(document.uri);
            }
        },

        getSelectionRanges(document, positions) {
            if (isTsDocument(document)) {
                return host.getTsLs().getSelectionRanges(document.uri, positions);
            }
        },

        getSignatureHelp(document, position, context) {
            if (isTsDocument(document)) {
                return host.getTsLs().getSignatureHelp(document.uri, position, context);
            }
        },

        format(document, range, options) {
            if (isTsDocument(document)) {
                return host.getTsLs().doFormatting(document.uri, options, range);
            }
        },

        callHierarchy: {

            doPrepare(document, position) {
                if (isTsDocument(document)) {
                    return host.getTsLs().callHierarchy.doPrepare(document.uri, position);
                }
            },

            getIncomingCalls(item) {
                return host.getTsLs().callHierarchy.getIncomingCalls(item);
            },

            getOutgoingCalls(item) {
                return host.getTsLs().callHierarchy.getOutgoingCalls(item);
            },
        },
    };
});

export function isTsDocument(document: TextDocument) {
    return document.languageId === 'javascript' ||
        document.languageId === 'typescript' ||
        document.languageId === 'javascriptreact' ||
        document.languageId === 'typescriptreact';
}

export function isJsonDocument(document: TextDocument) {
    return document.languageId === 'json' ||
        document.languageId === 'jsonc';
}
