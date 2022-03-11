import { SassFormatter } from 'sass-formatter';
import * as vscode from 'vscode-languageserver-protocol';
import { EmbeddedLanguagePlugin } from '../utils/definePlugin';

export default function (): EmbeddedLanguagePlugin {

    return {

        format(document, range, options) {

            if (document.languageId !== 'sass')
                return;

            const _options: Parameters<typeof SassFormatter.Format>[1] = {
                insertSpaces: options.insertSpaces,
            };

            if (options.insertSpaces)
                _options.tabSize = options.tabSize; // move tabSize here to fix sass-formatter judge

            const newStyleText = SassFormatter.Format(document.getText(), _options);

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
}
