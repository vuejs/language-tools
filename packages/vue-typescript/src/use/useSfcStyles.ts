import { computed, Ref } from '@vue/reactivity';
import * as SourceMaps from '@volar/source-map';
import * as shared from '@volar/shared';
import { Embedded, EmbeddedFile } from '../vueFile';
import { EmbeddedFileSourceMap } from '../utils/sourceMaps';

export function useSfcStyles(
	fileName: string,
	styles: Ref<shared.Sfc['styles']>,
) {

	const files = computed(() => {

		const _files: EmbeddedFile<{
			module: string | undefined,
			scoped: boolean,
		}>[] = [];

		for (let i = 0; i < styles.value.length; i++) {

			const style = styles.value[i];

			_files.push({
				fileName: fileName + '.' + i + '.' + style.lang,
				lang: style.lang,
				content: style.content,
				lsType: 'nonTs',
				capabilities: {
					diagnostics: true,
					foldingRanges: true,
					formatting: true,
					documentSymbol: true,
					codeActions: true,
				},
				data: {
					module: style.module,
					scoped: style.scoped,
				},
			});
		}

		return _files;
	});
	const embeddeds = computed(() => {

		const _embeddeds: Embedded[] = [];

		for (let i = 0; i < styles.value.length && i < files.value.length; i++) {

			const file = files.value[i];
			const style = styles.value[i];
			const sourceMap = new EmbeddedFileSourceMap();

			sourceMap.mappings.push({
				data: {
					vueTag: 'style',
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
					start: style.startTagEnd,
					end: style.startTagEnd + style.content.length,
				},
				mappedRange: {
					start: 0,
					end: style.content.length,
				},
			});

			_embeddeds.push({ file, sourceMap });
		}

		return _embeddeds;
	});

	return {
		files,
		embeddeds,
	};
}
