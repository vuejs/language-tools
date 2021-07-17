import type * as ts from 'typescript';
import {
	Position,
	Range,
	ResponseError,
} from 'vscode-languageserver/node';
import { uriToFsPath } from '@volar/shared';
import type { TextDocument } from 'vscode-languageserver-textdocument';

/* typescript-language-features is hardcode true */
export const renameInfoOptions = { allowRenameOfImportPath: true };

export function register(
	languageService: ts.LanguageService,
	getTextDocument: (uri: string) => TextDocument | undefined,
) {
	return (uri: string, position: Position): Range | undefined | ResponseError<void> => {
		const document = getTextDocument(uri);
		if (!document) return;

		const fileName = uriToFsPath(document.uri);
		const offset = document.offsetAt(position);

		const renameInfo = languageService.getRenameInfo(fileName, offset, renameInfoOptions);
		if (!renameInfo.canRename) {
			return new ResponseError(0, renameInfo.localizedErrorMessage);
		}

		return {
			start: document.positionAt(renameInfo.triggerSpan.start),
			end: document.positionAt(renameInfo.triggerSpan.start + renameInfo.triggerSpan.length),
		};
	};
}
