import { transformCompletionItem } from '@volar/transforms';
import { CompletionItem, MarkupKind } from 'vscode-languageserver/node';
import { SourceFile } from '../sourceFile';
import type { TsApiRegisterOptions } from '../types';
import { CompletionData, HtmlCompletionData, TsCompletionData } from '../types';

export function register({ sourceFiles, tsLanguageService }: TsApiRegisterOptions) {
	return (item: CompletionItem, newOffset?: number) => {

		const data: CompletionData | undefined = item.data;
		if (!data) return item;

		const sourceFile = sourceFiles.get(data.uri);
		if (!sourceFile) return item;

		if (data.mode === 'ts') {
			return getTsResult(sourceFile, item, data);
		}
		if (data.mode === 'html') {
			return getHtmlResult(sourceFile, item, data);
		}

		return item;

		function getTsResult(sourceFile: SourceFile, vueItem: CompletionItem, data: TsCompletionData) {
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				if (sourceMap.mappedDocument.uri !== data.docUri) continue;

				let newTsOffset: number | undefined;
				if (newOffset) {
					for (const tsRange of sourceMap.getMappedRanges2(newOffset)) {
						if (!tsRange.data.capabilities.completion) continue;
						newTsOffset = tsRange.start;
						break;
					}
				}

				data.tsItem = tsLanguageService.doCompletionResolve(data.tsItem, newTsOffset);
				const newVueItem = transformCompletionItem(
					data.tsItem,
					tsRange => sourceMap.getSourceRange(tsRange.start, tsRange.end),
				);
				newVueItem.data = data;
				// TODO: this is a patch for import ts file icon
				if (newVueItem.detail !== data.tsItem.detail + '.ts') {
					newVueItem.detail = data.tsItem.detail;
				}
				return newVueItem;
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
