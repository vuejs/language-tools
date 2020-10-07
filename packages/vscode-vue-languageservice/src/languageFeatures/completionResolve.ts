import { CompletionItem } from 'vscode-languageserver';
import { CompletionData } from '../utils/types';
import { SourceFile } from '../sourceFiles';

export function register(sourceFiles: Map<string, SourceFile>) {
	return (item: CompletionItem) => {
		const data: CompletionData = item.data;
		const sourceFile = sourceFiles.get(data.uri);
		if (!sourceFile) return;

		if (data.mode === 'ts') {
			item = getTsResult(sourceFile, item);
		}
		if (data.mode === 'html') {
			item = getHtmlResult(sourceFile, item);
		}

		return item;

		function getTsResult(sourceFile: SourceFile, item: CompletionItem) {
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				if (sourceMap.virtualDocument.uri !== data.docUri) continue;
				item = sourceMap.languageService.doCompletionResolve(item);
				if (item.additionalTextEdits) {
					for (const textEdit of item.additionalTextEdits) {
						const vueLoc = sourceMap.findFirstVueLocation(textEdit.range);
						if (vueLoc) {
							textEdit.range = vueLoc.range;
						}
					}
				}
			}
			return item;
		}
		function getHtmlResult(sourceFile: SourceFile, item: CompletionItem) {
			let tsItem: CompletionItem | undefined = item.data.tsItem;
			const tsLanguageService = sourceFile.getTsSourceMaps()[0]?.languageService;
			if (!tsItem || !tsLanguageService) return item;

			tsItem = tsLanguageService.doCompletionResolve(tsItem);
			item.tags = tsItem.tags;
			item.detail = tsItem.detail;
			item.documentation = tsItem.documentation;

			return item;
		}
	}
}
