import { Diagnostic } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { SourceFile } from '../sourceFiles';

export function register(sourceFiles: Map<string, SourceFile>) {
	return async (document: TextDocument, response: (result: Diagnostic[]) => void, isCancel?: () => Promise<boolean>) => {
		const sourceFile = sourceFiles.get(document.uri);
		await sourceFile?.getDiagnostics(response, isCancel);
	};
}
