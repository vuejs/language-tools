import { TextDocument } from 'vscode-languageserver-textdocument';
import * as shared from '@volar/shared';
import { computed, Ref } from '@vue/reactivity';
import * as SourceMaps from '../utils/sourceMaps';

import type * as _0 from 'typescript/lib/tsserverlibrary'; // fix TS2742

export function useSfcScript(
	vueUri: string,
	vueDoc: Ref<TextDocument>,
	script: Ref<shared.Sfc['scriptSetup']>,
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
			const lang = script.value.lang;
			const uri = `${vueUri}.${lang}`;
			return TextDocument.create(uri, shared.syntaxToLanguageId(lang), version++, script.value.content);
		}
	});
	const sourceMapId = SourceMaps.getEmbeddedDocumentSourceMapId();
	const sourceMap = computed(() => {
		if (textDocument.value && script.value) {
			const sourceMap = new SourceMaps.EmbeddedDocumentSourceMap(sourceMapId, vueDoc.value, textDocument.value, 'template', {
				foldingRanges: true,
				formatting: true,
				documentSymbol: true,
				codeActions: false,
			});
			sourceMap.mappings.push({
				data: {
					vueTag: 'script',
					capabilities: {},
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
