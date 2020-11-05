import { TextDocument } from 'vscode-languageserver-textdocument';
import { syntaxToLanguageId } from '@volar/shared';
import { computed, Ref } from '@vue/reactivity';
import { IDescriptor } from '../types';
import { MapedMode, TsSourceMap } from '../utils/sourceMaps';
import * as upath from 'upath';

export function useScriptRaw(
	getUnreactiveDoc: () => TextDocument,
	script: Ref<IDescriptor['script']>,
	scriptSetup: Ref<IDescriptor['scriptSetup']>,
) {
	let version = 0;
	const textDocument = computed(() => {
		if (script.value) {
			const vueDoc = getUnreactiveDoc();
			const lang = script.value.lang;
			const uri = `${vueDoc.uri}.script.${lang}`;
			const languageId = syntaxToLanguageId(lang);
			const content = script.value.content;
			return TextDocument.create(uri, languageId, version++, content);
		}
		if (scriptSetup.value) {
			const vueDoc = getUnreactiveDoc();
			const lang = 'ts';
			const uri = `${vueDoc.uri}.script.${lang}`;
			const languageId = syntaxToLanguageId(lang);
			const content = [
				`import * as __VLS_setups from './${upath.basename(vueDoc.uri)}.script.setup.raw';`,
				`import { defineComponent } from '@vue/runtime-dom';`,
				`type __VLS_DefaultType<T> = T extends { default: infer K } ? K : new () => ({});`,
				`type __VLS_NonDefaultType<T> = Omit<T, 'default'>;`,
				`declare const __VLS_default: __VLS_DefaultType<typeof __VLS_setups>;`,
				`declare const __VLS_nonDefault: __VLS_NonDefaultType<typeof __VLS_setups>;`,
				`export default defineComponent({`,
				`	setup() { return {`,
				`		...new __VLS_default(),`,
				`		...__VLS_nonDefault,`,
				`	} }`,
				`});`,
			].join('\n')
			return TextDocument.create(uri, languageId, version++, content);
		}
	});
	const sourceMap = computed(() => {
		if (textDocument.value && script.value) {
			const vueDoc = getUnreactiveDoc();
			const sourceMap = new TsSourceMap(vueDoc, textDocument.value, false, { foldingRanges: true });
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
