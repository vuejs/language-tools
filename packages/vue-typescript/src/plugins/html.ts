import { VueLanguagePlugin } from "../vueFile";

export default function (): VueLanguagePlugin {

	return {

		compileTemplate(template, lang) {

			if (lang === 'html') {

				return {
					html: template,
					mapping: (htmlStart, htmlEnd) => ({ start: htmlStart, end: htmlEnd }),
				};
			}
		}
	};
}
