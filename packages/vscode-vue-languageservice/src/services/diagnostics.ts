import type { TsApiRegisterOptions } from '../types';
import { Diagnostic } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';

export function register({ sourceFiles }: TsApiRegisterOptions) {
	return async (document: TextDocument, response: (result: Diagnostic[]) => void, isCancel?: () => Promise<boolean>, withSideEffect = true) => {
		const sourceFile = sourceFiles.get(document.uri);
		await sourceFile?.getDiagnostics(response, isCancel, withSideEffect);
	};
}
