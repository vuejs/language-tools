import { VueLanguagePlugin } from '../vueFile';
import * as SourceMaps from '@volar/source-map';
import { Embedded, EmbeddedFile } from '../vueFile';
import { EmbeddedFileSourceMap } from '../utils/sourceMaps';

export default function (): VueLanguagePlugin {

	return {

		getEmbeddedFilesCount(sfc) {
			return sfc.styles.length;
		},

		getEmbeddedFile(fileName, sfc, i) {

			const style = sfc.styles[i];
			const file: EmbeddedFile = {
				fileName: fileName + '.' + i + '.' + style.lang,
				content: style.content,
				capabilities: {
					diagnostics: true,
					foldingRanges: true,
					formatting: true,
					documentSymbol: true,
					codeActions: true,
					inlayHints: true,
				},
				isTsHostFile: false,
			};
			const sourceMap = new EmbeddedFileSourceMap();

			sourceMap.mappings.push({
				data: {
					vueTag: style.tag,
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
					end: style.content.length,
				},
				mappedRange: {
					start: 0,
					end: style.content.length,
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
