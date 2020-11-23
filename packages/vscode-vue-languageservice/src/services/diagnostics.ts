import { Diagnostic } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { SourceFile } from '../sourceFiles';

export function register(sourceFiles: Map<string, SourceFile>) {
	return async (document: TextDocument, response: (result: Diagnostic[]) => void, isCancel?: () => boolean) => {
		const sourceFile = sourceFiles.get(document.uri);
		const result = await sourceFile?.getDiagnostics(isCancel);
		if (result && (!isCancel || !isCancel())) {
			response(result);
		}
	};
}
