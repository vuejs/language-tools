import * as shared from '@volar/shared';
import { computed, Ref } from '@vue/reactivity';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as SourceMaps from '../utils/sourceMaps';

export function useSfcJsons(
	vueUri: string,
	vueDoc: Ref<TextDocument>,
	customBlocks: Ref<shared.Sfc['customBlocks']>,
) {
	let version = 0;
	const textDocuments = computed(() => {
		const documents: {
			index: number,
			textDocument: TextDocument,
		}[] = [];
		for (let i = 0; i < customBlocks.value.length; i++) {
			const customBlock = customBlocks.value[i];
			const lang = customBlock.lang;
			const content = customBlock.content;
			const uri = vueUri + '.' + i + '.' + lang;
			const document = TextDocument.create(uri, lang, version++, content);
			if (lang === 'json' || lang === 'jsonc') {
				documents.push({
					index: i,
					textDocument: document,
				});
			}
		}
		return documents;
	});
	const sourceMaps = computed(() => {
		const sourceMaps: SourceMaps.JsonSourceMap[] = [];
		for (const doc of textDocuments.value) {
			const customBlock = customBlocks.value[doc.index];
			const sourceMap = new SourceMaps.JsonSourceMap(
				vueDoc.value,
				doc.textDocument,
			);
			sourceMap.mappings.push({
				data: undefined,
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
			sourceMaps.push(sourceMap);
		}
		return sourceMaps;
	});
	return {
		textDocuments,
		sourceMaps,
	};
}
