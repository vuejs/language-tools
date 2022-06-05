import { VueLanguagePlugin } from '../vueFile';

export default function (): VueLanguagePlugin {

	return {

		compileFileToVue(fileName, content) {

			if (fileName.endsWith('.md')) {

				// return {
				// 	vue: content,
				// 	mapping(start, end) {
				// 		return { start, end };
				// 	},
				// }
				return undefined;
			}
		}
	};
}
