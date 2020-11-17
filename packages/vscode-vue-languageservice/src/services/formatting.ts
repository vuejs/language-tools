import {
	TextDocument,
	FormattingOptions,
	Range,
} from 'vscode-languageserver';
import { SourceFile } from '../sourceFiles';
import { formattingWorker } from './rangeFormatting';
import type * as ts2 from '@volar/vscode-typescript-languageservice';

export function register(sourceFiles: Map<string, SourceFile>, tsLanguageService: ts2.LanguageService) {
	return (document: TextDocument, options: FormattingOptions) => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;
		const range = Range.create(
			document.positionAt(0),
			document.positionAt(document.getText().length),
		);
		return formattingWorker(sourceFile, document, options, range, tsLanguageService);
	};
}
