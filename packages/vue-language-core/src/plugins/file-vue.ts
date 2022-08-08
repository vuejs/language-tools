import { VueLanguagePlugin } from '../sourceFile';
import { parse } from '@vue/compiler-sfc';

export default function (): VueLanguagePlugin {

	return {

		parseSfc(fileName, content) {

			if (fileName.endsWith('.vue')) {

				return parse(content, { sourceMap: false, ignoreEmpty: false });
			}
		}
	};
}
