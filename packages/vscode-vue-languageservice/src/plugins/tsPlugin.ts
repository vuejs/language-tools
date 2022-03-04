import { TextDocument } from 'vscode-languageserver-textdocument';
import { definePlugin } from './definePlugin';
import * as ts2 from 'vscode-typescript-languageservice';
import * as vscode from 'vscode-languageserver-protocol';

export default definePlugin((host: {
    typescript: typeof import('typescript/lib/tsserverlibrary'),
    tsLs: ts2.LanguageService,
    baseCompletionOptions: ts.GetCompletionsAtPositionOptions,
}) => {

    const basicTriggerCharacters = ts2.getTriggerCharacters(host.typescript.version);
    const jsdocTriggerCharacter = '*';

    return {

        triggerCharacters: [...basicTriggerCharacters, jsdocTriggerCharacter],

        async onCompletion(textDocument, position, context) {

            if (!isValidLanguage(textDocument))
                return;

            let basicComplete: vscode.CompletionList | undefined;

            if (!context?.triggerCharacter || basicTriggerCharacters.includes(context.triggerCharacter)) {

                const options: ts.GetCompletionsAtPositionOptions = {
                    ...host.baseCompletionOptions,
                    triggerCharacter: context?.triggerCharacter as ts.CompletionsTriggerCharacter,
                    triggerKind: context?.triggerKind,
                };

                basicComplete = await host.tsLs.doComplete(textDocument.uri, position, options);
            }

            withJsDocComplete();

            return basicComplete;

            function withJsDocComplete() {

                if (context?.triggerCharacter && context.triggerCharacter !== jsdocTriggerCharacter)
                    return;

                const jsDocComplete = host.tsLs.doJsDocComplete(textDocument.uri, position);

                if (jsDocComplete) {

                    if (basicComplete) {
                        basicComplete.items.push(jsDocComplete);
                    }
                    else {
                        basicComplete = {
                            isIncomplete: false,
                            items: [jsDocComplete],
                        };
                    }
                }
            }
        },

        async onCompletionResolve(item) {
            return host.tsLs.doCompletionResolve(item);
        },

        async onHover(textDocument, position) {

            if (!isValidLanguage(textDocument))
                return;

            return host.tsLs.doHover(textDocument.uri, position);
        },
    };

    function isValidLanguage(textDocument: TextDocument) {
        return textDocument.languageId === 'javascript' ||
            textDocument.languageId === 'typescript' ||
            textDocument.languageId === 'javascriptreact' ||
            textDocument.languageId === 'typescriptreact' ||
            textDocument.languageId === 'json'
    }
});
