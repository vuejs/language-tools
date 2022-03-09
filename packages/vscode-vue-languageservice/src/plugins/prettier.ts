import * as prettier from 'prettier';
import * as vscode from 'vscode-languageserver-protocol';
import { definePlugin } from '../utils/definePlugin';

export default definePlugin((host: {
    allowLanguageIds: prettier.BuiltInParserName[]
}) => {

    return {

        format(document, range, options) {

            if (!host.allowLanguageIds.includes(document.languageId as prettier.BuiltInParserName))
                return;

            const newStyleText = prettier.format(document.getText(), {
                tabWidth: options.tabSize,
                useTabs: !options.insertSpaces,
                parser: document.languageId as prettier.BuiltInParserName,
            });

            if (newStyleText === document.getText())
                return;

            const cssEdit = vscode.TextEdit.replace(
                vscode.Range.create(
                    document.positionAt(0),
                    document.positionAt(document.getText().length),
                ),
                '\n' + newStyleText
            );

            return [cssEdit];
        },
    }
});
