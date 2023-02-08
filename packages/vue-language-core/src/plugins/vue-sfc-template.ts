import { FileCapabilities, FileRangeCapabilities } from '@volar/language-core';
import { VueLanguagePlugin } from '../types';

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
			const match = embeddedFile.fileName.match(/^(.*)\.template\.([^.]+)$/);
			if (match && sfc.template) {
				embeddedFile.capabilities = FileCapabilities.full;
				embeddedFile.content.push([
					sfc.template.content,
					sfc.template.name,
					0,
					FileRangeCapabilities.full,
				]);
			}
		},
	};
};
export = plugin;
