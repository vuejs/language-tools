import * as vscode from 'vscode-languageserver-protocol';
import { definePlugin } from './definePlugin';

const pugBeautify = require('pug-beautify');

export default definePlugin(() => {

    return {

        format(document, range, options) {

            if (document.languageId !== 'jade')
                return;

            const pugCode = document.getText();

            // fix https://github.com/johnsoncodehk/volar/issues/304
            if (pugCode.trim() === '')
                return;

            const prefixesLength = pugCode.length - pugCode.trimStart().length;
            const suffixesLength = pugCode.length - pugCode.trimEnd().length;
            const prefixes = pugCode.substr(0, prefixesLength);
            const suffixes = pugCode.substr(pugCode.length - suffixesLength);
            const newPugCode: string = pugBeautify(pugCode, {
                tab_size: options.tabSize,
                fill_tab: !options.insertSpaces,
            });

            if (newPugCode === document.getText())
                return;

            const pugEdit = vscode.TextEdit.replace(
                vscode.Range.create(
                    document.positionAt(0),
                    document.positionAt(pugCode.length),
                ),
                prefixes + newPugCode.trim() + suffixes,
            );

            return [pugEdit];
        },
    }
});
