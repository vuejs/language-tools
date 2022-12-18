import { LanguageServicePlugin, LanguageServicePluginContext } from '@volar/language-service';

export default function (): LanguageServicePlugin {

	let context: LanguageServicePluginContext;

	return {

		setup(_context) {
			context = _context;
		},

		async doAutoInsert(document, position) {

			if (document.languageId === 'html' || document.languageId === 'jade') {

				const enabled = await context.env.configurationHost?.getConfiguration<boolean>('volar.addSpaceBetweenDoubleCurlyBrackets') ?? true;
				if (!enabled)
					return;

				const prev = document.getText({
					start: { line: position.line, character: position.character - 2 },
					end: position,
				});
				if (prev === '{{') {
					const next = document.getText({
						start: position,
						end: { line: position.line, character: position.character + 2 },
					});
					if (next === '}}') {
						return ` $0 `;
					}
				}
			}
		},
	};
}
