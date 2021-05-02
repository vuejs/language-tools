import type { Diagnostic } from 'vscode-languageserver';
import type { TsApiRegisterOptions } from '../types';

export function register({ sourceFiles }: TsApiRegisterOptions) {
	return async (uri: string, response: (result: Diagnostic[]) => void, isCancel?: () => Promise<boolean>) => {
		const sourceFile = sourceFiles.get(uri);
		await sourceFile?.getDiagnostics(response, isCancel);
	};
}
