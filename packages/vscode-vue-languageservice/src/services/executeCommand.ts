import * as vscode from 'vscode-languageserver';
import { Commands } from '../commands';
import * as convertTagNameCase from '../commands/convertTagNameCase';
import { execute as executeHtmlToPug } from '../commands/htmlToPug';
import { execute as executePugToHtml } from '../commands/pugToHtml';
import { execute as executeShowReferences } from '../commands/showReferences';
import * as useSetupSugar from '../commands/useSetupSugar';
import * as unuseSetupSugar from '../commands/unuseSetupSugar';
import * as useRefSugar from '../commands/useRefSugar';
import * as unuseRefSugar from '../commands/unuseRefSugar';
import type { ApiLanguageServiceContext } from '../types';

export function register(context: ApiLanguageServiceContext) {

	const { sourceFiles } = context;
	const doUseSetupSugar = useSetupSugar.register(context);
	const doUnuseSetupSugar = unuseSetupSugar.register(context);
	const doUseRefSugar = useRefSugar.register(context);
	const doUnuseRefSugar = unuseRefSugar.register(context);
	const doConvertTagNameCase = convertTagNameCase.register(context);

	return async (uri: string, command: string, args: any[] | undefined, connection: vscode.Connection) => {

		if (command === Commands.SHOW_REFERENCES && args) {
			await executeShowReferences(args[0], args[1], args[2], connection);
		}
		if (command === Commands.USE_SETUP_SUGAR) {
			await doUseSetupSugar(connection, uri);
		}
		if (command === Commands.UNUSE_SETUP_SUGAR) {
			await doUnuseSetupSugar(connection, uri);
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
			await doConvertTagNameCase(connection, context, uri, 'kebab');
		}
		if (command === Commands.CONVERT_TO_PASCAL_CASE) {
			await doConvertTagNameCase(connection, context, uri, 'pascal');
		}
	}
}
