import { enableAllFeatures } from '../generators/utils';
import { VueLanguagePlugin } from '../types';

const styleReg = /^(.*)\.style_(\d+)\.([^.]+)$/;

const plugin: VueLanguagePlugin = () => {

	return {

		version: 1,

		getEmbeddedFileNames(fileName, sfc) {
			const names: string[] = [];
			for (let i = 0; i < sfc.styles.length; i++) {
				const style = sfc.styles[i];
				names.push(fileName + '.style_' + i + '.' + style.lang);
			}
			return names;
		},

		resolveEmbeddedFile(_fileName, sfc, embeddedFile) {
			const match = embeddedFile.fileName.match(styleReg);
			if (match) {
				const index = parseInt(match[2]);
				const style = sfc.styles[index];

				embeddedFile.content.push([
					style.content,
					style.name,
					0,
					enableAllFeatures({}),
				]);
			}
		},
	};
};

export default plugin;
