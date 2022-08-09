import * as SourceMaps from '@volar/source-map';
import { VueLanguagePlugin } from '../sourceFile';

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
					diagnostics: false,
					foldingRanges: true,
					formatting: true,
					documentSymbol: true,
					codeActions: false,
					inlayHints: false,
				};
				embeddedFile.isTsHostFile = false;
				embeddedFile.codeGen.addCode(
					script.content,
					{
						start: 0,
						end: script.content.length,
					},
					SourceMaps.Mode.Offset,
					{
						vueTag: script.tag,
						capabilities: {},
					},
				);
			}
		},
	};
}
export default plugin;
