import * as vscode from 'vscode-languageserver';
import type { ApiLanguageServiceContext } from '../types';

export function register(context: ApiLanguageServiceContext) {

	return async (connection: vscode.Connection, uri: string) => {
		throw 'TODO';
	};
}
