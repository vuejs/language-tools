import {
	CompletionItem,
} from 'vscode-languageserver';
import { SourceFile } from '../sourceFiles';
import { TsCompletionData } from '../utils/types';

export function register(sourceFiles: Map<string, SourceFile>) {
	return (item: CompletionItem) => {
		const data: TsCompletionData = item.data;
		if (data.mode === 'ts') {
			item = data.languageService.doCompletionResolve(data.document, data.position, item);
		}
		return item;
	}
}
