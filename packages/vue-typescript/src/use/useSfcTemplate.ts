import * as shared from '@volar/shared';
import { computed, Ref } from '@vue/reactivity';
import { EmbeddedFileSourceMap } from '../utils/sourceMaps';
import * as SourceMaps from '@volar/source-map';
import { Embedded, EmbeddedFile } from '../vueFile';

export function useSfcTemplate(
	fileName: string,
	template: Ref<shared.Sfc['template']>,
) {

	const file = computed(() => {

		if (template.value) {

			const file: EmbeddedFile = {
				fileName: fileName + '.' + template.value.lang,
				lang: template.value.lang,
				content: template.value.content,
				lsType: 'nonTs',
				capabilities: {
					diagnostics: true,
					foldingRanges: true,
					formatting: true,
					documentSymbol: true,
					codeActions: true,
				},
				data: undefined,
			};

			return file;
		}
	});
	const embedded = computed<Embedded | undefined>(() => {

		if (template.value && file.value) {

			const sourceMap = new EmbeddedFileSourceMap();

			sourceMap.mappings.push({
				data: {
					vueTag: 'template',
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
					start: template.value.startTagEnd,
					end: template.value.startTagEnd + template.value.content.length,
				},
				mappedRange: {
					start: 0,
					end: template.value.content.length,
				},
			});

			return {
				file: file.value,
				sourceMap,
			};
		}
	});

	return {
		file,
		embedded,
	};
}
