import { TextDocument } from 'vscode-languageserver-textdocument';
import { syntaxToLanguageId } from '@volar/shared';
import { computed, Ref } from '@vue/reactivity';
import { IDescriptor } from '../types';
import { MapedMode, HtmlSourceMap, PugSourceMap } from '../utils/sourceMaps';
import * as languageServices from '../utils/languageServices';

export function useTemplateRaw(
	getUnreactiveDoc: () => TextDocument,
	template: Ref<IDescriptor['template']>,
) {
	let version = 0;
	const textDocument = computed(() => {
		if (template.value) {
			const vueDoc = getUnreactiveDoc();
			const langId = syntaxToLanguageId(template.value.lang);
			const uri = vueDoc.uri + '.' + template.value.lang;
			const content = template.value.content;
			const document = TextDocument.create(uri, langId, version++, content);
			return document;
		}
	});
	const htmlDocument = computed(() => {
		if (textDocument.value?.languageId === 'html') {
			return languageServices.html.parseHTMLDocument(textDocument.value);
		}
	});
	const htmlSourceMap = computed(() => {
		if (textDocument.value && textDocument.value && template.value && htmlDocument.value) {
			const vueDoc = getUnreactiveDoc();
			const sourceMap = new HtmlSourceMap(
				vueDoc,
				textDocument.value,
				htmlDocument.value,
			);
			sourceMap.add({
				data: undefined,
				mode: MapedMode.Offset,
				sourceRange: {
					start: template.value.loc.start,
					end: template.value.loc.end,
				},
				targetRange: {
					start: 0,
					end: template.value.loc.end - template.value.loc.start,
				},
			});
			return sourceMap;
		}
	});
	const pugDocument = computed(() => {
		if (textDocument.value?.languageId === 'jade') {
			return languageServices.pug.parsePugDocument(textDocument.value);
		}
	});
	const pugSourceMap = computed(() => {
		if (textDocument.value && template.value && pugDocument.value) {
			const vueDoc = getUnreactiveDoc();
			const sourceMap = new PugSourceMap(
				vueDoc,
				textDocument.value,
				pugDocument.value,
			);
			sourceMap.add({
				data: undefined,
				mode: MapedMode.Offset,
				sourceRange: {
					start: template.value.loc.start,
					end: template.value.loc.end,
				},
				targetRange: {
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
