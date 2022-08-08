import * as SourceMaps from '@volar/source-map';
import { VueLanguagePlugin } from '../sourceFile';

export default function (): VueLanguagePlugin {

	return {

		getEmbeddedFileNames(fileName, sfc) {
			const names: string[] = [];
			for (let i = 0; i < sfc.styles.length; i++) {
				const style = sfc.styles[i];
				names.push(fileName + '.style_' + i + '.' + style.lang);
			}
			return names;
		},

		resolveEmbeddedFile(fileName, sfc, embeddedFile) {
			const match = embeddedFile.fileName.match(/^(.*)\.style_(\d+)\.([^.]+)$/);
			if (match) {
				const index = parseInt(match[2]);
				const style = sfc.styles[index];

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
					style.content,
					{
						start: 0,
						end: style.content.length,
					},
					SourceMaps.Mode.Offset,
					{
						vueTag: style.tag,
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
