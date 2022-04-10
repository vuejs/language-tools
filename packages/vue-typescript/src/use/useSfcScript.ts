import { computed, Ref } from '@vue/reactivity';
import { EmbeddedFileSourceMap } from '../utils/sourceMaps';
import * as SourceMaps from '@volar/source-map';

import type * as _0 from 'typescript/lib/tsserverlibrary'; // fix TS2742
import { Embedded, EmbeddedFile, Sfc } from '../vueFile';

export function useSfcScript(
	fileName: string,
	script: Ref<Sfc['script'] | Sfc['scriptSetup']>,
	ts: typeof import('typescript/lib/tsserverlibrary'),
) {

	const ast = computed(() => {
		if (script.value) {
			return ts.createSourceFile(fileName + '.' + script.value.lang, script.value.content, ts.ScriptTarget.Latest);
		}
	});
	const file = computed(() => {

		if (script.value) {

			const file: EmbeddedFile = {
				fileName: fileName + '.__VLS_script.format.' + script.value.lang,
				lang: script.value.lang,
				content: script.value.content,
				capabilities: {
					diagnostics: false,
					foldingRanges: true,
					formatting: true,
					documentSymbol: true,
					codeActions: false,
				},
				data: undefined,
				isTsHostFile: false,
			};

			return file;
		}
	});
	const embedded = computed<Embedded | undefined>(() => {

		if (script.value && file.value) {

			const sourceMap = new EmbeddedFileSourceMap();

			sourceMap.mappings.push({
				data: {
					vueTag: 'script',
					capabilities: {},
				},
				mode: SourceMaps.Mode.Offset,
				sourceRange: {
					start: script.value.startTagEnd,
					end: script.value.startTagEnd + script.value.content.length,
				},
				mappedRange: {
					start: 0,
					end: script.value.content.length,
				},
			});
			return {
				file: file.value,
				sourceMap,
			};
		}
	});

	return {
		ast,
		file,
		embedded,
	};
}
