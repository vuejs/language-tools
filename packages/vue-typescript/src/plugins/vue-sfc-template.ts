import { VueLanguagePlugin } from '../vueFile';
import * as SourceMaps from '@volar/source-map';
import { Embedded, EmbeddedFile } from '../vueFile';
import { EmbeddedFileSourceMap } from '../utils/sourceMaps';

export default function (): VueLanguagePlugin {

	return {

		getEmbeddedFilesCount(sfc) {
			return sfc.template ? 1 : 0;
		},

		getEmbeddedFile(fileName, sfc, i) {

			const template = sfc.template!;
			const file: EmbeddedFile = {
				fileName: fileName + '.' + template.lang,
				lang: template.lang,
				content: template.content,
				capabilities: {
					diagnostics: true,
					foldingRanges: true,
					formatting: true,
					documentSymbol: true,
					codeActions: true,
					inlayHints: true,
				},
				data: undefined,
				isTsHostFile: false,
			};
			const sourceMap = new EmbeddedFileSourceMap();

			sourceMap.mappings.push({
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

			const embedded: Embedded = {
				file,
				sourceMap,
			};

			return embedded;
		},
	};
}
