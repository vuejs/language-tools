import { TextDocument } from 'vscode-languageserver-textdocument';
import * as shared from '@volar/shared';
import { computed, Ref } from '@vue/reactivity';
import * as SourceMaps from '../utils/sourceMaps';

export function useSfcTemplate(
	vueUri: string,
	vueDoc: Ref<TextDocument>,
	template: Ref<shared.Sfc['template']>,
) {
	let version = 0;
	const textDocument = computed(() => {
		if (template.value) {
			const langId = shared.syntaxToLanguageId(template.value.lang);
			const uri = vueUri + '.' + template.value.lang;
			const content = template.value.content;
			const document = TextDocument.create(uri, langId, version++, content);
			return document;
		}
	});
	const sourceMapId = SourceMaps.getEmbeddedDocumentSourceMapId();
	const sourceMap = computed(() => {
		if (textDocument.value && template.value) {
			const sourceMap = new SourceMaps.EmbeddedDocumentSourceMap(
				sourceMapId,
				vueDoc.value,
				textDocument.value,
				'nonTs'
			);
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
			return sourceMap;
		}
	});
	return {
		textDocument,
		sourceMap,
	};
}
