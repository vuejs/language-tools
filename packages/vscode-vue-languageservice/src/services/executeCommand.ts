import * as vscode from 'vscode-languageserver';
import { Commands } from '../commands';
import { execute as executeConvertTagNameCase } from '../commands/convertTagNameCase';
import { execute as executeHtmlToPug } from '../commands/htmlToPug';
import { execute as executePugToHtml } from '../commands/pugToHtml';
import { execute as executeShowReferences } from '../commands/showReferences';
import * as unuseRefSugar from '../commands/unuseRefSugar';
import * as useRefSugar from '../commands/useRefSugar';
import type { ApiLanguageServiceContext } from '../types';
import * as references from '../services/references';

export function register(context: ApiLanguageServiceContext) {

	const { sourceFiles } = context;
	const findReferences = references.register(context);
	const doUseRefSugar = useRefSugar.register(context);
	const doUnuseRefSugar = unuseRefSugar.register(context);

	return async (uri: string, command: string, args: any[] | undefined, connection: vscode.Connection) => {

		if (command === Commands.SHOW_REFERENCES && args) {
			await executeShowReferences(args[0], args[1], args[2], connection);
		}
		if (command === Commands.USE_REF_SUGAR) {
			await doUseRefSugar(connection, uri);
		}
		if (command === Commands.UNUSE_REF_SUGAR) {
			await doUnuseRefSugar(connection, uri);
		}
		if (command === Commands.HTML_TO_PUG) {
			const sourceFile = sourceFiles.get(uri);
			const document = sourceFile?.getTextDocument();
			if (sourceFile && document)
				await executeHtmlToPug(document, sourceFile, connection);
		}
		if (command === Commands.PUG_TO_HTML) {
			const sourceFile = sourceFiles.get(uri);
			const document = sourceFile?.getTextDocument();
			if (sourceFile && document)
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
