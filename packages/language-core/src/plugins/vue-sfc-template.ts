import { enableAllFeatures } from '../generators/utils';
import { VueLanguagePlugin } from '../types';

const templateReg = /^(.*)\.template\.([^.]+)$/;

const plugin: VueLanguagePlugin = () => {

	return {

		version: 1,

		getEmbeddedFileNames(fileName, sfc) {
			if (sfc.template) {
				return [fileName + '.template.' + sfc.template.lang];
			}
			return [];
		},

		resolveEmbeddedFile(_fileName, sfc, embeddedFile) {
			const match = embeddedFile.fileName.match(templateReg);
			if (match && sfc.template) {
				embeddedFile.content.push([
					sfc.template.content,
					sfc.template.name,
					0,
					enableAllFeatures({}),
				]);
			}
		},
	};
};

export default plugin;
