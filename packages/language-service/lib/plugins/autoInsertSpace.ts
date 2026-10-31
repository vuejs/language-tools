import type { LanguageServicePlugin } from '@volar/language-service';

export function create(): LanguageServicePlugin {
	return {
		name: 'vue-autoinsert-space',
		capabilities: {
			autoInsertionProvider: {
				triggerCharacters: ['}'],
				configurationSections: ['vue.autoInsert.bracketSpacing'],
			},
		},
		create() {
			return {
				provideAutoInsertSnippet(document, selection, change) {
					if (document.languageId === 'html' || document.languageId === 'jade') {
						if (
							change.text === '{}'
							&& document.getText().slice(change.rangeOffset - 1, change.rangeOffset + 3) === '{{}}'
							&& document.offsetAt(selection) === change.rangeOffset + 1
						) {
							return ` $0 `;
						}
					}
				},
			};
		},
	};
}
