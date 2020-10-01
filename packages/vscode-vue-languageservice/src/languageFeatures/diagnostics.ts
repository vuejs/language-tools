import {
	TextDocument,
	Diagnostic,
} from 'vscode-languageserver';
import { SourceFile } from '../sourceFiles';

export function register(sourceFiles: Map<string, SourceFile>, gerTsProjectVersion: () => string) {
	return async (document: TextDocument, isCancel: () => boolean, onProcess: (diags: Diagnostic[]) => void) => {
		const sourceFile = sourceFiles.get(document.uri);
		return await sourceFile?.getDiagnostics(gerTsProjectVersion(), isCancel, onProcess);
	};
}
