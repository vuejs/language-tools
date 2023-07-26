import { Service } from '@volar/language-service';

const plugin: Service = (context): ReturnType<Service> => {

	if (!context)
		return {};

	return {

		async provideAutoInsertionEdit(document, _, { lastChange }) {

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
};

export default () => plugin;
