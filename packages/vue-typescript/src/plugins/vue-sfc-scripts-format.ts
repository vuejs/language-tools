import { VueLanguagePlugin } from '../vueFile';
import * as SourceMaps from '@volar/source-map';
import { Embedded, EmbeddedFile } from '../vueFile';
import { EmbeddedFileSourceMap } from '../utils/sourceMaps';

export default function (): VueLanguagePlugin {

	return {

		getEmbeddedFilesCount(sfc) {
			return 2;
		},

		getEmbeddedFile(fileName, sfc, i) {

			const script = i === 0 ? sfc.script : sfc.scriptSetup;
			if (!script)
				return;

			const file: EmbeddedFile = {
				fileName: fileName + '.__VLS_script.format.' + script.lang,
				lang: script.lang,
				content: script.content,
				capabilities: {
					diagnostics: false,
					foldingRanges: true,
					formatting: true,
					documentSymbol: true,
					codeActions: false,
					inlayHints: false,
				},
				data: undefined,
				isTsHostFile: false,
			};
			const sourceMap = new EmbeddedFileSourceMap();

			sourceMap.mappings.push({
				data: {
					vueTag: script.tag,
					capabilities: {},
				},
				mode: SourceMaps.Mode.Offset,
				sourceRange: {
					start: 0,
					end: script.content.length,
				},
				mappedRange: {
					start: 0,
					end: script.content.length,
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
