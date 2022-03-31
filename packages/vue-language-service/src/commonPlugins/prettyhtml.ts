import * as prettyhtml from '@starptech/prettyhtml';
import * as vscode from 'vscode-languageserver-protocol';
import { EmbeddedLanguageServicePlugin } from '@volar/vue-language-service-types';

export default function (options: {
    getPrintWidth: (uri: string) => number | Promise<number>,
}): EmbeddedLanguageServicePlugin {

    return {

        async format(document, range, options_2) {

            if (document.languageId !== 'html')
                return;

            const newHtml = prettyhtml(document.getText(), {
                tabWidth: options_2.tabSize,
                useTabs: !options_2.insertSpaces,
                printWidth: await options.getPrintWidth(document.uri),
            }).contents;

            if (newHtml === document.getText())
                return [];

            const htmlEdit = vscode.TextEdit.replace(
                vscode.Range.create(
                    document.positionAt(0),
                    document.positionAt(document.getText().length),
                ),
                newHtml,
            );

            return [htmlEdit];
        },
    }
}
