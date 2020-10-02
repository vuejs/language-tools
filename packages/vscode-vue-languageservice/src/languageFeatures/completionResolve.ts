import {
	CompletionItem,
} from 'vscode-languageserver';
import { TsCompletionData } from '../utils/types';
import type * as ts from '@volar/vscode-typescript-languageservice';

export function register(ls: ts.LanguageService) {
	return (item: CompletionItem) => {
		const data: TsCompletionData = item.data;
		if (data.mode === 'ts') {
			item = ls.doCompletionResolve(item);
		}
		return item;
	}
}
