import * as SourceMaps from '@volar/source-map';
import { EmbeddedFile, VueLanguagePlugin } from '../sourceFile';

export default function (): VueLanguagePlugin {

	return {

		getEmbeddedFilesCount(fileName, sfc) {
			return 2;
		},

		getEmbeddedFile(fileName, sfc, i) {

			const script = i === 0 ? sfc.script : sfc.scriptSetup;
			if (!script)
				return;

			const file: EmbeddedFile = {
				fileName: fileName + '.__VLS_script.format.' + script.lang,
				content: script.content,
				capabilities: {
					diagnostics: false,
					foldingRanges: true,
					formatting: true,
					documentSymbol: true,
					codeActions: false,
					inlayHints: false,
				},
				isTsHostFile: false,
				mappings: [],
			};

			file.mappings.push({
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

			return file;
		},
	};
}
