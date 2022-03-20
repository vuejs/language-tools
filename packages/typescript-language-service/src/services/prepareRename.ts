import type * as ts from 'typescript/lib/tsserverlibrary';
import * as vscode from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';

/* typescript-language-features is hardcode true */
export const renameInfoOptions = { allowRenameOfImportPath: true };

export function register(
	languageService: ts.LanguageService,
	getTextDocument: (uri: string) => TextDocument | undefined,
) {
	return (uri: string, position: vscode.Position): vscode.Range | undefined | vscode.ResponseError<void> => {
		const document = getTextDocument(uri);
		if (!document) return;

		const offset = document.offsetAt(position);

		let renameInfo: ReturnType<typeof languageService.getRenameInfo> | undefined;
		try { renameInfo = languageService.getRenameInfo(document.uri, offset, renameInfoOptions); } catch { }
		if (!renameInfo) return;

		if (!renameInfo.canRename) {
			return new vscode.ResponseError(0, renameInfo.localizedErrorMessage);
		}

		return {
			start: document.positionAt(renameInfo.triggerSpan.start),
			end: document.positionAt(renameInfo.triggerSpan.start + renameInfo.triggerSpan.length),
		};
	};
}
