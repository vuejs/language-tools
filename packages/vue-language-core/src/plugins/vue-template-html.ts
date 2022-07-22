import { VueLanguagePlugin } from '../sourceFile';

export default function (): VueLanguagePlugin {

	return {

		compileTemplateToHtml(lang, template) {

			if (lang === 'html') {

				return {
					html: template,
					mapping: htmlRange => htmlRange,
				};
			}
		}
	};
}
