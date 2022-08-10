import * as SourceMaps from '@volar/source-map';
import { VueLanguagePlugin } from '../sourceFile';

const plugin: VueLanguagePlugin = () => {

	return {

		getEmbeddedFileNames(fileName, sfc) {
			if (sfc.template) {
				return [fileName + '.template.' + sfc.template.lang];
			}
			return [];
		},

		resolveEmbeddedFile(fileName, sfc, embeddedFile) {
			const match = embeddedFile.fileName.match(/^(.*)\.template\.([^.]+)$/);
			if (match && sfc.template) {
				embeddedFile.capabilities = {
					diagnostics: true,
					foldingRanges: true,
					formatting: true,
					documentSymbol: true,
					codeActions: true,
					inlayHints: true,
				};
				embeddedFile.isTsHostFile = false;
				embeddedFile.codeGen.addCode(
					sfc.template.content,
					{
						start: 0,
						end: sfc.template.content.length,
					},
					SourceMaps.Mode.Offset,
					{
						vueTag: sfc.template.tag,
						capabilities: {
							basic: true,
							references: true,
							definitions: true,
							diagnostic: true,
							rename: true,
							completion: true,
							semanticTokens: true,
						},
					},
				);
			}
		},
	};
}
export default plugin;
