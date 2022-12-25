import { LanguageServicePlugin, LanguageServicePluginContext } from '@volar/language-service';

export default function (): LanguageServicePlugin {

	let context: LanguageServicePluginContext;

	return {

		setup(_context) {
			context = _context;
		},

		async doAutoInsert(document, _, { lastChange }) {

			if (document.languageId === 'html' || document.languageId === 'jade') {

				const enabled = await context.env.configurationHost?.getConfiguration<boolean>('volar.addSpaceBetweenDoubleCurlyBrackets') ?? true;
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
}
