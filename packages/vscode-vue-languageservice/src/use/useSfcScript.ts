import { TextDocument } from 'vscode-languageserver-textdocument';
import * as shared from '@volar/shared';
import { computed, Ref } from '@vue/reactivity';
import * as SourceMaps from '../utils/sourceMaps';

export function useSfcScript(
	getUnreactiveDoc: () => TextDocument,
	script: Ref<shared.Sfc['script']>,
	ts: typeof import('typescript/lib/tsserverlibrary'),
) {
	let version = 0;
	const ast = computed(() => {
		if (script.value) {
			return ts.createSourceFile('foo.' + script.value.lang, script.value.content, ts.ScriptTarget.Latest);
		}
	});
	const textDocument = computed(() => {
		if (script.value) {
			const vueDoc = getUnreactiveDoc();
			const lang = script.value.lang;
			const uri = `${vueDoc.uri}.${lang}`;
			return TextDocument.create(uri, shared.syntaxToLanguageId(lang), version++, script.value.content);
		}
	});
	const sourceMap = computed(() => {
		if (textDocument.value && script.value) {
			const vueDoc = getUnreactiveDoc();
			const sourceMap = new SourceMaps.TsSourceMap(vueDoc, textDocument.value, 'template', false, {
				foldingRanges: true,
				formatting: true,
				documentSymbol: false,
				codeActions: false,
			});
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
					start: script.value.startTagEnd,
					end: script.value.startTagEnd + script.value.content.length,
				},
				mappedRange: {
					start: 0,
					end: script.value.content.length,
				},
			});
			return sourceMap;
		}
	});
	return {
		ast,
		textDocument,
		sourceMap,
	};
}
