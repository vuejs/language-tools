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
		create(context) {
			return {
				async provideAutoInsertSnippet(document, selection, change) {

					if (document.languageId === 'html' || document.languageId === 'jade') {

						const enabled = await context.env.getConfiguration?.<boolean>('vue.autoInsert.bracketSpacing') ?? true;
						if (!enabled) {
							return;
						}

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
