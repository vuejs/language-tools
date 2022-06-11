import { VueLanguagePlugin } from '../vueFile';

export default function (): VueLanguagePlugin {

	return {

		compileFileToVue(fileName, content) {
			
			if (fileName.endsWith('.vue')) {

				return {
					vue: content,
					mappings: [{
						fileOffset: 0,
						vueOffset: 0,
						length: content.length,
					}],
				}
			}
		}
	};
}
