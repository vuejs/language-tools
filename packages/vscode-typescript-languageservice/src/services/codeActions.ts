import type * as ts from 'typescript';
import {
	Range,
	CodeActionContext,
	CodeAction,
} from 'vscode-languageserver/node';
import { uriToFsPath } from '@volar/shared';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { fileTextChangesToWorkspaceEdit } from './rename';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined) {
	return (uri: string, range: Range, context: CodeActionContext) => {

		const document = getTextDocument(uri);
		if (!document) return;

		const fileName = uriToFsPath(document.uri);
		const start = document.offsetAt(range.start);
		const end = document.offsetAt(range.start);
		const errorCodes = context.diagnostics.map(error => error.code) as number[];
		try {
			const codeFixes = languageService.getCodeFixesAtPosition(fileName, start, end, errorCodes, {} /* TODO */, {} /* TODO */);
			const codeActions: CodeAction[] = [];

			for (const codeFix of codeFixes) {
				const edit = fileTextChangesToWorkspaceEdit(codeFix.changes, getTextDocument);
				const codeAction = CodeAction.create(
					codeFix.description,
					edit,
					codeFix.fixName,
				);
				codeActions.push(codeAction);
			}

			return codeActions;
		} catch {
			return [];
		}
	};
}
