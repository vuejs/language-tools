import { computed, Ref } from '@vue/reactivity';
import * as SourceMaps from '@volar/source-map';
import * as shared from '@volar/shared';
import { Embedded, EmbeddedFile } from '../vueDocument';
import { EmbeddedFileSourceMap } from '../utils/sourceMaps';

export function useSfcCustomBlocks(
	fileName: string,
	customBlocks: Ref<shared.Sfc['customBlocks']>,
) {

	const files = computed(() => {

		const _files: EmbeddedFile[] = [];

		for (let i = 0; i < customBlocks.value.length; i++) {

			const customBlock = customBlocks.value[i];

			_files.push({
				fileName: fileName + '.' + i + '.' + customBlock.lang,
				lang: customBlock.lang,
				content: customBlock.content,
				lsType: 'nonTs',
				capabilities: {
					diagnostics: true,
					foldingRanges: true,
					formatting: true,
					documentSymbol: true,
					codeActions: true,
				},
				data: undefined,
			});
		}

		return _files;
	});
	const embeddeds = computed(() => {

		const _embeddeds: Embedded[] = [];

		for (let i = 0; i < customBlocks.value.length && i < files.value.length; i++) {

			const file = files.value[i];
			const customBlock = customBlocks.value[i];
			const sourceMap = new EmbeddedFileSourceMap();

			sourceMap.mappings.push({
				data: {
					vueTag: 'customBlock',
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
					start: customBlock.startTagEnd,
					end: customBlock.startTagEnd + customBlock.content.length,
				},
				mappedRange: {
					start: 0,
					end: customBlock.content.length,
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
