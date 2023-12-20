import { ServicePlugin, ServicePluginInstance } from '@volar/language-service';

export function create(): ServicePlugin {
	return {
		name: 'vue-autoinsert-space',
		create(context): ServicePluginInstance {
			return {
				async provideAutoInsertionEdit(document, _, lastChange) {

					if (document.languageId === 'html' || document.languageId === 'jade') {

						const enabled = await context.env.getConfiguration?.<boolean>('vue.autoInsert.bracketSpacing') ?? true;
						if (!enabled)
							return;

						if (
							lastChange.text === '{}'
							&& document.getText({
								start: { line: lastChange.range.start.line, character: lastChange.range.start.character - 1 },
								end: { line: lastChange.range.start.line, character: lastChange.range.start.character + 3 }
							}) === '{{}}'
						) {
							return {
								newText: ` $0 `,
								range: {
									start: { line: lastChange.range.start.line, character: lastChange.range.start.character + 1 },
									end: { line: lastChange.range.start.line, character: lastChange.range.start.character + 1 }
								},
							};
						}
					}
				},
			};
		},
	};
}
