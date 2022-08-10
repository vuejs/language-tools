import { VueLanguagePlugin } from '../sourceFile';
import { parse } from '@vue/compiler-sfc';

const plugin: VueLanguagePlugin = () => {

	return {

		parseSFC(fileName, content) {

			if (fileName.endsWith('.vue')) {

				return parse(content, { sourceMap: false, ignoreEmpty: false });
			}
		}
	};
}
export default plugin;
