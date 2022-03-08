import * as prettyhtml from '@starptech/prettyhtml';
import * as vscode from 'vscode-languageserver-protocol';
import { definePlugin } from '../utils/definePlugin';

export default definePlugin((host: {
    getPrintWidth: (uri: string) => number | Promise<number>,
}) => {

    return {

        async format(document, range, options) {

            if (document.languageId !== 'html')
                return;

            let newHtml = prettyhtml(document.getText(), {
                tabWidth: options.tabSize,
                useTabs: !options.insertSpaces,
                printWidth: await host.getPrintWidth(document.uri),
            }).contents;

            if (newHtml === document.getText())
                return;

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
});
