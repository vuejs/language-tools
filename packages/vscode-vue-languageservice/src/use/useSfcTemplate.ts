import { TextDocument } from 'vscode-languageserver-textdocument';
import * as shared from '@volar/shared';
import { computed, Ref } from '@vue/reactivity';
import * as SourceMaps from '../utils/sourceMaps';

import type * as _0 from 'vscode-html-languageservice';  // fix TS2742

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
	const htmlSourceMap = computed(() => {
		if (textDocument.value && template.value && template.value.lang === 'html') {
			const sourceMap = new SourceMaps.HtmlSourceMap(
				vueDoc.value,
				textDocument.value,
			);
			sourceMap.mappings.push({
				data: undefined,
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
	const pugSourceMap = computed(() => {
		if (textDocument.value && template.value && template.value.lang === 'pug') {
			const sourceMap = new SourceMaps.PugSourceMap(
				vueDoc.value,
				textDocument.value,
			);
			sourceMap.mappings.push({
				data: undefined,
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
		htmlSourceMap,
		pugSourceMap,
	};
}
