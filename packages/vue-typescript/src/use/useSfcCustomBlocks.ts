import * as shared from '@volar/shared';
import { computed, Ref } from '@vue/reactivity';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as SourceMaps from '../utils/sourceMaps';

export function useSfcCustomBlocks(
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
			documents.push({
				index: i,
				textDocument: document,
			});
		}
		return documents;
	});
	const sourceMaps = computed(() => {
		const sourceMaps: SourceMaps.EmbeddedDocumentSourceMap[] = [];
		for (const doc of textDocuments.value) {
			const customBlock = customBlocks.value[doc.index];
			const sourceMap = new SourceMaps.EmbeddedDocumentSourceMap(
				vueDoc.value,
				doc.textDocument,
			);
			sourceMap.mappings.push({
				data: {
					vueTag: undefined,
					capabilities: {
						basic: true,
						references: true,
						definitions: true,
						diagnostic: true,
						formatting: true,
						rename: true,
						completion: true,
						semanticTokens: true,
						foldingRanges: true,
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
			sourceMaps.push(sourceMap);
		}
		return sourceMaps;
	});
	return {
		textDocuments,
		sourceMaps,
	};
}
