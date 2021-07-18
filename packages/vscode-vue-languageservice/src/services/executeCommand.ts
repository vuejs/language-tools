import * as vscode from 'vscode-languageserver';
import { Commands } from '../commands';
import { execute as executeConvertTagNameCase } from '../commands/convertTagNameCase';
import { execute as executeHtmlToPug } from '../commands/htmlToPug';
import { execute as executePugToHtml } from '../commands/pugToHtml';
import { execute as executeShowReferences } from '../commands/showReferences';
import { execute as executeUnuseRefSugar } from '../commands/unuseRefSugar';
import { execute as executeUseRefSugar } from '../commands/useRefSugar';
import type { ApiLanguageServiceContext } from '../types';

export function register(
	{ sourceFiles, scriptTsLs, ts }: ApiLanguageServiceContext,
	findReferences: (uri: string, position: vscode.Position) => vscode.Location[],
	findTypeDefinition: (uri: string, position: vscode.Position) => vscode.LocationLink[],
) {

	return async (uri: string, command: string, args: any[] | undefined, connection: vscode.Connection) => {

		if (command === Commands.SHOW_REFERENCES && args) {
			executeShowReferences(args[0], args[1], args[2], connection);
		}

		const sourceFile = sourceFiles.get(uri);
		if (!sourceFile)
			return;

		const document = sourceFile.getTextDocument();

		if (command === Commands.SWITCH_REF_SUGAR) {

			const scriptSetupData = sourceFile.getScriptSetupData();
			if (!scriptSetupData)
				return;

			if (scriptSetupData.labels.length) {
				executeUnuseRefSugar(ts, document, sourceFile, connection, findReferences, findTypeDefinition, scriptTsLs);
			}
			else {
				executeUseRefSugar(ts, document, sourceFile, connection, findReferences);
			}
		}
		if (command === Commands.HTML_TO_PUG) {
			executeHtmlToPug(document, sourceFile, connection);
		}
		if (command === Commands.PUG_TO_HTML) {
			executePugToHtml(document, sourceFile, connection);
		}
		if (command === Commands.CONVERT_TO_KEBAB_CASE) {
			executeConvertTagNameCase(document, sourceFile, connection, findReferences, 'kebab');
		}
		if (command === Commands.CONVERT_TO_PASCAL_CASE) {
			executeConvertTagNameCase(document, sourceFile, connection, findReferences, 'pascal');
		}
	}
}
