import type { Diagnostic } from 'vscode-languageserver';
import type { ApiLanguageServiceContext } from '../types';

export function register({ sourceFiles }: ApiLanguageServiceContext) {
	return async (uri: string, response: (result: Diagnostic[]) => void, isCancel?: () => Promise<boolean>) => {
		const sourceFile = sourceFiles.get(uri);
		await sourceFile?.getDiagnostics(response, isCancel);
	};
}
