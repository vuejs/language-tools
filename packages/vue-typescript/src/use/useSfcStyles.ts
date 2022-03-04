import { TextDocument } from 'vscode-languageserver-textdocument';
import { computed, Ref } from '@vue/reactivity';
import * as SourceMaps from '../utils/sourceMaps';
import * as shared from '@volar/shared';

export function useSfcStyles(
	vueUri: string,
	vueDoc: Ref<TextDocument>,
	styles: Ref<shared.Sfc['styles']>,
) {

	let version = 0;

	const textDocuments = computed(() => {
		const documents: {
			textDocument: TextDocument,
			module: string | undefined,
			scoped: boolean,
		}[] = [];
		for (let i = 0; i < styles.value.length; i++) {
			const style = styles.value[i];
			const lang = style.lang;
			let content = style.content;
			const documentUri = vueUri + '.' + i + '.' + lang;
			const document = TextDocument.create(documentUri, lang, version++, content);
			documents.push({
				textDocument: document,
				module: style.module,
				scoped: style.scoped,
			});
		}
		return documents;
	});
	const sourceMapsId = SourceMaps.getEmbeddedDocumentSourceMapId();
	const sourceMaps = computed(() => {
		const sourceMaps: SourceMaps.EmbeddedDocumentSourceMap[] = [];
		for (let i = 0; i < styles.value.length && i < textDocuments.value.length; i++) {

			const cssData = textDocuments.value[i];
			const style = styles.value[i];

			const sourceMap = new SourceMaps.EmbeddedDocumentSourceMap(
				sourceMapsId,
				vueDoc.value,
				cssData.textDocument,
			);
			sourceMap.mappings.push({
				data: {
					vueTag: 'style',
					vueTagIndex: i,
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
					start: style.startTagEnd,
					end: style.startTagEnd + style.content.length,
				},
				mappedRange: {
					start: 0,
					end: style.content.length,
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
