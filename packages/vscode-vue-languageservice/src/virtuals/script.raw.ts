import { TextDocument } from 'vscode-languageserver-textdocument';
import { syntaxToLanguageId, getValidScriptSyntax } from '@volar/shared';
import { computed, Ref } from '@vue/reactivity';
import { IDescriptor } from '../types';
import * as SourceMaps from '../utils/sourceMaps';
export function useScriptFormat(
	getUnreactiveDoc: () => TextDocument,
	script: Ref<IDescriptor['script']>,
) {
	let version = 0;
	const textDocument = computed(() => {
		if (script.value) {
			const vueDoc = getUnreactiveDoc();
			const lang = getValidScriptSyntax(script.value.lang);
			const uri = `${vueDoc.uri}.${lang}`;
			return TextDocument.create(uri, syntaxToLanguageId(lang), version++, script.value.content);
		}
	});
	const sourceMap = computed(() => {
		if (textDocument.value && script.value) {
			const vueDoc = getUnreactiveDoc();
			const sourceMap = new SourceMaps.TsSourceMap(vueDoc, textDocument.value, false, { foldingRanges: true, formatting: true, documentSymbol: false });
			sourceMap.add({
				data: {
					vueTag: 'script',
					capabilities: {
						formatting: true,
						foldingRanges: true,
					},
				},
				mode: SourceMaps.Mode.Offset,
				sourceRange: {
					start: script.value.loc.start,
					end: script.value.loc.end,
				},
				mappedRange: {
					start: 0,
					end: script.value.loc.end - script.value.loc.start,
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
