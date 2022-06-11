import * as SourceMaps from '@volar/source-map';
import { EmbeddedFile, VueLanguagePlugin } from '../vueFile';

export default function (): VueLanguagePlugin {

	return {

		getEmbeddedFilesCount(sfc) {
			return sfc.template ? 1 : 0;
		},

		getEmbeddedFile(fileName, sfc, i) {

			const template = sfc.template!;
			const file: EmbeddedFile = {
				fileName: fileName + '.' + template.lang,
				content: template.content,
				capabilities: {
					diagnostics: true,
					foldingRanges: true,
					formatting: true,
					documentSymbol: true,
					codeActions: true,
					inlayHints: true,
				},
				isTsHostFile: false,
				mappings: [],
			};

			file.mappings.push({
				data: {
					vueTag: template.tag,
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
				mode: SourceMaps.Mode.Offset,
				sourceRange: {
					start: 0,
					end: template.content.length,
				},
				mappedRange: {
					start: 0,
					end: template.content.length,
				},
			});

			return file;
		},
	};
}
