import { CompletionItem, MarkupKind } from 'vscode-languageserver';
import { CompletionData, TsCompletionData, HtmlCompletionData } from '../utils/types';
import { SourceFile } from '../sourceFiles';
import { translateAdditionalTextEdits } from './completions';
import type * as ts2 from '@volar/vscode-typescript-languageservice';

export function register(sourceFiles: Map<string, SourceFile>, tsLanguageService: ts2.LanguageService) {
	return (item: CompletionItem) => {
		const data: CompletionData = item.data;
		const sourceFile = sourceFiles.get(data.uri);
		if (!sourceFile) return;

		if (data.mode === 'ts') {
			return getTsResult(sourceFile, item, data);
		}
		if (data.mode === 'html') {
			return getHtmlResult(sourceFile, item, data);
		}

		return item;

		function getTsResult(sourceFile: SourceFile, vueItem: CompletionItem, data: TsCompletionData) {
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				if (sourceMap.targetDocument.uri !== data.docUri) continue;
				data.tsItem = tsLanguageService.doCompletionResolve(data.tsItem);
				vueItem.documentation = data.tsItem.documentation;
				// TODO: this is a patch for import ts file icon
				if (vueItem.detail !== data.tsItem.detail + '.ts') {
					vueItem.detail = data.tsItem.detail;
				}
				vueItem.additionalTextEdits = translateAdditionalTextEdits(data.tsItem.additionalTextEdits, sourceMap);
			}
			return vueItem;
		}
		function getHtmlResult(sourceFile: SourceFile, vueItem: CompletionItem, data: HtmlCompletionData) {
			let tsItem: CompletionItem | undefined = data.tsItem;
			if (!tsItem) return vueItem;

			tsItem = tsLanguageService.doCompletionResolve(tsItem);
			vueItem.tags = [...vueItem.tags ?? [], ...tsItem.tags ?? []];

			const details: string[] = [];
			const documentations: string[] = [];

			if (vueItem.detail) details.push(vueItem.detail);
			if (tsItem.detail) details.push(tsItem.detail);
			if (details.length) {
				vueItem.detail = details.join('\n\n');
			}

			if (vueItem.documentation) documentations.push(typeof vueItem.documentation === 'string' ? vueItem.documentation : vueItem.documentation.value);
			if (tsItem.documentation) documentations.push(typeof tsItem.documentation === 'string' ? tsItem.documentation : tsItem.documentation.value);
			if (documentations.length) {
				vueItem.documentation = {
					kind: MarkupKind.Markdown,
					value: documentations.join('\n\n'),
				};
			}

			return vueItem;
		}
	}
}
