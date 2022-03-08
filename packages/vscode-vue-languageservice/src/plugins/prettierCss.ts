import * as prettier from 'prettier';
import * as vscode from 'vscode-languageserver-protocol';
import { definePlugin } from '../utils/definePlugin';

export default definePlugin(() => {

    return {

        format(document, range, options) {

            if (
                document.languageId !== 'css' &&
                document.languageId !== 'less' &&
                document.languageId !== 'scss' &&
                document.languageId !== 'postcss'
            ) return;

            const newStyleText = prettier.format(document.getText(), {
                tabWidth: options.tabSize,
                useTabs: !options.insertSpaces,
                parser: document.languageId,
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
