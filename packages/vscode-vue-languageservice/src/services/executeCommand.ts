import * as vscode from 'vscode-languageserver';
import { Commands } from '../commands';
import { execute as executeConvertTagNameCase } from '../commands/convertTagNameCase';
import { execute as executeHtmlToPug } from '../commands/htmlToPug';
import { execute as executePugToHtml } from '../commands/pugToHtml';
import { execute as executeShowReferences } from '../commands/showReferences';
import type { ApiLanguageServiceContext } from '../types';

export function register(
	context: ApiLanguageServiceContext,
	findReferences: (uri: string, position: vscode.Position) => vscode.Location[],
) {

	const { modules: { typescript: ts }, sourceFiles } = context;

	return async (uri: string, command: string, args: any[] | undefined, connection: vscode.Connection) => {

		if (command === Commands.SHOW_REFERENCES && args) {
			await executeShowReferences(args[0], args[1], args[2], connection);
		}

		const sourceFile = sourceFiles.get(uri);
		if (!sourceFile)
			return;

		const document = sourceFile.getTextDocument();

		if (command === Commands.HTML_TO_PUG) {
			await executeHtmlToPug(document, sourceFile, connection);
		}
		if (command === Commands.PUG_TO_HTML) {
			await executePugToHtml(document, sourceFile, connection);
		}
		if (command === Commands.CONVERT_TO_KEBAB_CASE) {
			await executeConvertTagNameCase(connection, context, uri, findReferences, 'kebab');
		}
		if (command === Commands.CONVERT_TO_PASCAL_CASE) {
			await executeConvertTagNameCase(connection, context, uri, findReferences, 'pascal');
		}
	}
}
