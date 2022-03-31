import * as prettier from 'prettier';
import * as vscode from 'vscode-languageserver-protocol';
import { EmbeddedLanguageServicePlugin } from '@volar/vue-language-service-types';

export default function (options: {
    allowLanguageIds: prettier.BuiltInParserName[],
}): EmbeddedLanguageServicePlugin {

    return {

        format(document, range, options_2) {

            if (!options.allowLanguageIds.includes(document.languageId as prettier.BuiltInParserName))
                return;

            const newStyleText = prettier.format(document.getText(), {
                tabWidth: options_2.tabSize,
                useTabs: !options_2.insertSpaces,
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
