import {
	TextDocument,
	Diagnostic,
} from 'vscode-languageserver/node';
import { SourceFile } from '../sourceFiles';

export function register(sourceFiles: Map<string, SourceFile>) {
	return async (document: TextDocument, isCancel?: () => boolean, onProcess?: (diags: Diagnostic[]) => void) => {
		const sourceFile = sourceFiles.get(document.uri);
		return await sourceFile?.getDiagnostics(isCancel, onProcess);
	};
}
