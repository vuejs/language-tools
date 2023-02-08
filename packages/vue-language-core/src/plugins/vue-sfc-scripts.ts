import { FileCapabilities, FileKind } from '@volar/language-core';
import { VueLanguagePlugin } from '../types';

const plugin: VueLanguagePlugin = () => {

	return {

		version: 1,

		getEmbeddedFileNames(fileName, sfc) {
			const names: string[] = [];
			if (sfc.script) {
				names.push(fileName + '.__VLS_script_format.' + sfc.script.lang);
			}
			if (sfc.scriptSetup) {
				names.push(fileName + '.__VLS_scriptSetup_format.' + sfc.scriptSetup.lang);
			}
			return names;
		},

		resolveEmbeddedFile(_fileName, sfc, embeddedFile) {
			const scriptMatch = embeddedFile.fileName.match(/^(.*)\.__VLS_script_format\.([^.]+)$/);
			const scriptSetupMatch = embeddedFile.fileName.match(/^(.*)\.__VLS_scriptSetup_format\.([^.]+)$/);
			const script = scriptMatch ? sfc.script : scriptSetupMatch ? sfc.scriptSetup : undefined;
			if (script) {
				embeddedFile.kind = FileKind.TypeScriptHostFile;
				embeddedFile.capabilities = {
					...FileCapabilities.full,
					diagnostic: false,
					codeAction: false,
					inlayHint: false,
				};
				embeddedFile.content.push('export { };\n');
				embeddedFile.content.push([
					script.content,
					script.name,
					0,
					{},
				]);
			}
		},
	};
};
export = plugin;
