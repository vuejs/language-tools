import { VueLanguagePlugin } from '../types';

const scriptFormatReg = /^(.*)\.script_format\.([^.]+)$/;
const scriptSetupFormatReg = /^(.*)\.scriptSetup_format\.([^.]+)$/;

const plugin: VueLanguagePlugin = () => {

	return {

		version: 1,

		getEmbeddedFileNames(fileName, sfc) {
			const names: string[] = [];
			if (sfc.script) {
				names.push(fileName + '.script_format.' + sfc.script.lang);
			}
			if (sfc.scriptSetup) {
				names.push(fileName + '.scriptSetup_format.' + sfc.scriptSetup.lang);
			}
			return names;
		},

		resolveEmbeddedFile(_fileName, sfc, embeddedFile) {
			const scriptMatch = embeddedFile.fileName.match(scriptFormatReg);
			const scriptSetupMatch = embeddedFile.fileName.match(scriptSetupFormatReg);
			const script = scriptMatch ? sfc.script : scriptSetupMatch ? sfc.scriptSetup : undefined;
			if (script) {
				embeddedFile.content.push([
					script.content,
					script.name,
					0,
					{},
				]);
				embeddedFile.content.forEach(code => {
					if (typeof code !== 'string') {
						code[3].diagnostics = false;
						code[3].codeActions = false;
						code[3].inlayHints = false;
					}
				});
			}
		},
	};
};

export default plugin;
