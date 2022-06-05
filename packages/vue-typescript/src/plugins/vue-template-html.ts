import { VueLanguagePlugin } from '../vueFile';

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
