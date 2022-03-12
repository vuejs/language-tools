import * as prettier from 'prettier';
import * as vscode from 'vscode-languageserver-protocol';
import { EmbeddedLanguagePlugin } from '@volar/vue-language-service-types';

export default function (allowLanguageIds: prettier.BuiltInParserName[]): EmbeddedLanguagePlugin {

    return {

        format(document, range, options) {

            if (!allowLanguageIds.includes(document.languageId as prettier.BuiltInParserName))
                return;

            const newStyleText = prettier.format(document.getText(), {
                tabWidth: options.tabSize,
                useTabs: !options.insertSpaces,
                parser: document.languageId as prettier.BuiltInParserName,
            });

            if (newStyleText === document.getText())
                return [];

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
}
