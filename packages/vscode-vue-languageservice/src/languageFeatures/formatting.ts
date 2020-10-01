import {
	TextDocument,
	FormattingOptions,
	Range,
} from 'vscode-languageserver';
import { SourceFile } from '../sourceFiles';
import { formattingWorker } from './rangeFormatting';

export function register(sourceFiles: Map<string, SourceFile>) {
	return (document: TextDocument, options: FormattingOptions) => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;
		const range = Range.create(
			document.positionAt(0),
			document.positionAt(document.getText().length),
		);
		return formattingWorker(sourceFile, document, options, range);
	};
}
