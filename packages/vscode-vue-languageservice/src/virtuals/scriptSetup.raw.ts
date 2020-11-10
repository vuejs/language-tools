import { TextDocument } from 'vscode-languageserver-textdocument';
import { syntaxToLanguageId, getValidScriptSyntax } from '@volar/shared';
import { computed, Ref } from '@vue/reactivity';
import { IDescriptor } from '../types';
import { MapedMode, TsSourceMap } from '../utils/sourceMaps';
export function useScriptSetupFormat(
	getUnreactiveDoc: () => TextDocument,
	scriptSetup: Ref<IDescriptor['scriptSetup']>,
) {
	let version = 0;
	const textDocument = computed(() => {
		if (scriptSetup.value) {
			const vueDoc = getUnreactiveDoc();
			const lang = getValidScriptSyntax(scriptSetup.value.lang);
			const uri = `${vueDoc.uri}.scriptSetup.raw.${lang}`;
			return TextDocument.create(uri, syntaxToLanguageId(lang), version++, scriptSetup.value.content);
		}
	});
	const sourceMap = computed(() => {
		if (textDocument.value && scriptSetup.value) {
			const vueDoc = getUnreactiveDoc();
			const sourceMap = new TsSourceMap(vueDoc, textDocument.value, false, { foldingRanges: true, formatting: true });
			sourceMap.add({
				data: {
					vueTag: 'script',
					capabilities: {
						formatting: true,
					},
				},
				mode: MapedMode.Offset,
				sourceRange: {
					start: scriptSetup.value.loc.start,
					end: scriptSetup.value.loc.end,
				},
				targetRange: {
					start: 0,
					end: scriptSetup.value.loc.end - scriptSetup.value.loc.start,
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
