import * as SourceMaps from '@volar/source-map';
import { VueLanguagePlugin } from '../sourceFile';

const plugin: VueLanguagePlugin = () => {

	return {

		getEmbeddedFileNames(fileName, sfc) {
			const names: string[] = [];
			for (let i = 0; i < sfc.customBlocks.length; i++) {
				const customBlock = sfc.customBlocks[i];
				names.push(fileName + '.customBlock_' + customBlock.type + '_' + i + '.' + customBlock.lang);
			}
			return names;
		},

		resolveEmbeddedFile(fileName, sfc, embeddedFile) {
			const match = embeddedFile.fileName.match(/^(.*)\.customBlock_([^_]+)_(\d+)\.([^.]+)$/);
			if (match) {
				const index = parseInt(match[3]);
				const customBlock = sfc.customBlocks[index];

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
					customBlock.content,
					{
						start: 0,
						end: customBlock.content.length,
					},
					SourceMaps.Mode.Offset,
					{
						vueTag: customBlock.tag,
						vueTagIndex: index,
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
