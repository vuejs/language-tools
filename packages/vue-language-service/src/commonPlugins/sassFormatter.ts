import { SassFormatter } from 'sass-formatter';
import * as vscode from 'vscode-languageserver-protocol';
import { EmbeddedLanguageServicePlugin } from '@volar/vue-language-service-types';

export default function (): EmbeddedLanguageServicePlugin {

    return {

        format(document, range, options) {

            if (document.languageId !== 'sass')
                return;

            const _options: Parameters<typeof SassFormatter.Format>[1] = {
                insertSpaces: options.insertSpaces,
            };

            if (options.insertSpaces)
                _options.tabSize = options.tabSize; // move tabSize here to fix sass-formatter judge

            const newStyleText = SassFormatter.Format(document.getText(range), _options);

            if (newStyleText === document.getText())
                return [];

            const cssEdit = vscode.TextEdit.replace(
                range,
                '\n' + newStyleText
            );

            return [cssEdit];
        },
    }
}
