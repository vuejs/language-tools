import { VueLanguagePlugin } from '../vueFile';

export default function (): VueLanguagePlugin {

	return {

		compileTemplateToHtml(lang, template) {

			if (lang === 'pug') {

				let pug: typeof import('@volar/pug-language-service') | undefined;

				try {
					pug = require('@volar/pug-language-service');
				} catch { }

				const pugDoc = pug?.baseParse(template);

				if (pugDoc) {
					return {
						html: pugDoc.htmlCode,
						mapping: htmlRange => {
							const pugRange = pugDoc.sourceMap.getSourceRange(htmlRange.start, htmlRange.end, data => !data?.isEmptyTagCompletion)?.[0];
							if (pugRange) {
								return pugRange;
							}
							else {

								const pugStart = pugDoc.sourceMap.getSourceRange(htmlRange.start, htmlRange.start, data => !data?.isEmptyTagCompletion)?.[0]?.start;
								const pugEnd = pugDoc.sourceMap.getSourceRange(htmlRange.end, htmlRange.end, data => !data?.isEmptyTagCompletion)?.[0]?.end;

								if (pugStart !== undefined && pugEnd !== undefined) {
									return { start: pugStart, end: pugEnd };
								}
							}
						},
					};
				}
			}
		}
	};
}
