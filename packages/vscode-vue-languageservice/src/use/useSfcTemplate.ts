import { TextDocument } from 'vscode-languageserver-textdocument';
import * as shared from '@volar/shared';
import { computed, Ref } from '@vue/reactivity';
import { IDescriptor, LanguageServiceContext } from '../types';
import * as SourceMaps from '../utils/sourceMaps';

export function useSfcTemplate(
	getUnreactiveDoc: () => TextDocument,
	template: Ref<IDescriptor['template']>,
	context: LanguageServiceContext,
) {
	let version = 0;
	const textDocument = computed(() => {
		if (template.value) {
			const vueDoc = getUnreactiveDoc();
			const langId = shared.syntaxToLanguageId(template.value.lang);
			const uri = vueDoc.uri + '.' + template.value.lang;
			const content = template.value.content;
			const document = TextDocument.create(uri, langId, version++, content);
			return document;
		}
	});
	const htmlDocument = computed(() => {
		if (textDocument.value?.languageId === 'html') {
			return context.htmlLs.parseHTMLDocument(textDocument.value);
		}
	});
	const htmlSourceMap = computed(() => {
		if (textDocument.value && textDocument.value && template.value && htmlDocument.value) {
			const vueDoc = getUnreactiveDoc();
			const sourceMap = new SourceMaps.HtmlSourceMap(
				vueDoc,
				textDocument.value,
				htmlDocument.value,
			);
			sourceMap.add({
				data: undefined,
				mode: SourceMaps.Mode.Offset,
				sourceRange: {
					start: template.value.loc.start,
					end: template.value.loc.end,
				},
				mappedRange: {
					start: 0,
					end: template.value.loc.end - template.value.loc.start,
				},
			});
			return sourceMap;
		}
	});
	const pugDocument = computed(() => {
		if (textDocument.value?.languageId === 'jade') {
			return context.pugLs.parsePugDocument(textDocument.value);
		}
	});
	const pugSourceMap = computed(() => {
		if (textDocument.value && template.value && pugDocument.value) {
			const vueDoc = getUnreactiveDoc();
			const sourceMap = new SourceMaps.PugSourceMap(
				vueDoc,
				textDocument.value,
				pugDocument.value,
			);
			sourceMap.add({
				data: undefined,
				mode: SourceMaps.Mode.Offset,
				sourceRange: {
					start: template.value.loc.start,
					end: template.value.loc.end,
				},
				mappedRange: {
					start: 0,
					end: template.value.loc.end - template.value.loc.start,
				},
			});
			return sourceMap;
		}
	});
	return {
		textDocument,
		htmlSourceMap,
		pugSourceMap,
		htmlDocument,
		pugDocument,
	};
}
