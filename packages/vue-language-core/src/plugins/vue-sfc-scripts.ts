import { VueLanguagePlugin } from '../types';

const plugin: VueLanguagePlugin = () => {

	return {

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

		resolveEmbeddedFile(fileName, sfc, embeddedFile) {
			const scriptMatch = embeddedFile.fileName.match(/^(.*)\.script_format\.([^.]+)$/);
			const scriptSetupMatch = embeddedFile.fileName.match(/^(.*)\.scriptSetup_format\.([^.]+)$/);
			const script = scriptMatch ? sfc.script : scriptSetupMatch ? sfc.scriptSetup : undefined;
			if (script) {
				embeddedFile.capabilities = {
					diagnostic: false,
					foldingRange: true,
					documentFormatting: {
						initialIndentBracket: ['{', '}'],
					},
					documentSymbol: true,
					codeAction: false,
					inlayHint: false,
				};
				embeddedFile.appendContentFromSFCBlock(
					script,
					0,
					script.content.length,
					{},
				);
			}
		},
	};
};
export = plugin;
