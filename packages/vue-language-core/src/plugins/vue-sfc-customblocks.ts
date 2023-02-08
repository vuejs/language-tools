import { FileCapabilities, FileRangeCapabilities } from '@volar/language-core';
import { VueLanguagePlugin } from '../types';

const plugin: VueLanguagePlugin = () => {

	return {

		version: 1,

		getEmbeddedFileNames(fileName, sfc) {
			const names: string[] = [];
			for (let i = 0; i < sfc.customBlocks.length; i++) {
				const customBlock = sfc.customBlocks[i];
				names.push(fileName + '.customBlock_' + customBlock.type + '_' + i + '.' + customBlock.lang);
			}
			return names;
		},

		resolveEmbeddedFile(_fileName, sfc, embeddedFile) {
			const match = embeddedFile.fileName.match(/^(.*)\.customBlock_([^_]+)_(\d+)\.([^.]+)$/);
			if (match) {
				const index = parseInt(match[3]);
				const customBlock = sfc.customBlocks[index];

				embeddedFile.capabilities = FileCapabilities.full;
				embeddedFile.content.push([
					customBlock.content,
					customBlock.name,
					0,
					FileRangeCapabilities.full,
				]);
			}
		},
	};
};
export = plugin;
