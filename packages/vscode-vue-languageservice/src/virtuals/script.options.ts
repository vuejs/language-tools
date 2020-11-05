import { TextDocument } from 'vscode-languageserver-textdocument';
import { computed, Ref } from '@vue/reactivity';
import { IDescriptor } from '../types';
import { MapedMode, TsSourceMap } from '../utils/sourceMaps';

export function useScriptOptions(
	getUnreactiveDoc: () => TextDocument,
	script: Ref<IDescriptor['script']>,
	scriptSetup: Ref<IDescriptor['scriptSetup']>,
) {
	let version = 0;
	const textDocument = computed(() => {
		if (scriptSetup.value) {
			const vueDoc = getUnreactiveDoc();
			const uri = `${vueDoc.uri}.options.ts`;
			const languageId = 'typescript';
			const content = [
				scriptSetup.value.content,
				`declare function defineComponent<T>(options: T): T;`,
				`export { };`
			].join('\n');
			return TextDocument.create(uri, languageId, version++, content);
		}
		if (script.value) {
			const vueDoc = getUnreactiveDoc();
			const uri = `${vueDoc.uri}.options.ts`;
			const languageId = 'typescript';
			const content = [
				script.value.content,
				`declare function defineComponent<T>(options: T): T;`,
				`export { };`
			].join('\n');
			return TextDocument.create(uri, languageId, version++, content);
		}
	});
	const sourceMap = computed(() => {
		const start = scriptSetup.value?.loc.start ?? script.value?.loc.start;
		const end = scriptSetup.value?.loc.end ?? script.value?.loc.end;
		if (textDocument.value && start !== undefined && end !== undefined) {
			const vueDoc = getUnreactiveDoc();
			const sourceMap = new TsSourceMap(vueDoc, textDocument.value, false, { foldingRanges: false });
			sourceMap.add({
				data: {
					vueTag: 'script',
					capabilities: {
						basic: false,
						references: true,
						rename: true,
						diagnostic: false,
						formatting: false,
						completion: false,
						semanticTokens: false,
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
