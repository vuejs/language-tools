import { VueLanguagePlugin } from '../vueFile';
import * as SourceMaps from '@volar/source-map';
import { Embedded, EmbeddedFile } from '../vueFile';
import { EmbeddedFileSourceMap } from '../utils/sourceMaps';

export default function (): VueLanguagePlugin {

	return {

		getEmbeddedFilesCount(sfc) {
			return sfc.customBlocks.length;
		},

		getEmbeddedFile(fileName, sfc, i) {

			const customBlock = sfc.customBlocks[i];
			const file: EmbeddedFile = {
				fileName: fileName + '.' + i + '.' + customBlock.lang,
				lang: customBlock.lang,
				content: customBlock.content,
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
					vueTag: customBlock.tag,
					vueTagIndex: i,
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
					end: customBlock.content.length,
				},
				mappedRange: {
					start: 0,
					end: customBlock.content.length,
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
