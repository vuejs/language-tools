import { VueLanguagePlugin } from '../vueFile';

export default function (): VueLanguagePlugin {

	return {

		compileFileToVue(fileName, content) {
			
			if (fileName.endsWith('.vue')) {

				return {
					vue: content,
					mapping: vueRange => vueRange,
				}
			}
		}
	};
}
