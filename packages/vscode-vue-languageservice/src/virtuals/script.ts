import { TextDocument } from 'vscode-languageserver-textdocument';
import { syntaxToLanguageId, getValidScriptSyntax } from '@volar/shared';
import { computed, Ref } from '@vue/reactivity';
import { IDescriptor } from '../types';
import { MapedMode, TsSourceMap } from '../utils/sourceMaps';

export function useScriptRaw(
	getUnreactiveDoc: () => TextDocument,
	script: Ref<IDescriptor['script']>,
) {
	let version = 0;
	const textDocument = computed(() => {
		if (script.value) {
			const vueDoc = getUnreactiveDoc();
			const lang = getValidScriptSyntax(script.value.lang);
			const uri = `${vueDoc.uri}.script.${lang}`;
			const languageId = syntaxToLanguageId(lang);
			const content = script.value.content;
			return TextDocument.create(uri, languageId, version++, content);
		}
	});
	const sourceMap = computed(() => {
		if (textDocument.value && script.value) {
			const vueDoc = getUnreactiveDoc();
			const sourceMap = new TsSourceMap(vueDoc, textDocument.value, false, { foldingRanges: true, formatting: true });
			const start = script.value.loc.start;
			const end = script.value.loc.end;
			sourceMap.add({
				data: {
					vueTag: 'script',
					capabilities: {
						basic: true,
						references: true,
						rename: true,
						diagnostic: true,
						formatting: true,
						completion: true,
						semanticTokens: true,
					},
				},
				mode: MapedMode.Offset,
				sourceRange: {
					start: start,
					end: end,
				},
				targetRange: {
					start: 0,
					end: end - start,
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
