import type { Position, TextDocument } from 'vscode-languageserver-textdocument';
import { Location } from 'vscode-languageserver-types';
import type { Connection } from 'vscode-languageserver/node';
import { Commands } from '../commands';
import { execute as executeConvertTagNameCase } from '../commands/convertTagNameCase';
import { execute as executeHtmlToPug } from '../commands/htmlToPug';
import { execute as executePugToHtml } from '../commands/pugToHtml';
import { execute as executeShowReferences } from '../commands/showReferences';
import { execute as executeUnuseRefSugar } from '../commands/unuseRefSugar';
import { execute as executeUseRefSugar } from '../commands/useRefSugar';
import type { TsApiRegisterOptions } from '../types';

export function register({ sourceFiles, tsLanguageService, ts }: TsApiRegisterOptions, findReferences: (uri: string, position: Position) => Location[]) {

	return async (document: TextDocument, command: string, args: any[] | undefined, connection: Connection) => {

		if (command === Commands.SHOW_REFERENCES && args) {
			executeShowReferences(args[0], args[1], args[2], connection);
		}

		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile)
			return;

		if (command === Commands.SWITCH_REF_SUGAR) {

			const scriptSetupData = sourceFile.getScriptSetupData();
			if (!scriptSetupData)
				return;

			if (scriptSetupData.labels.length) {
				executeUnuseRefSugar(ts, document, sourceFile, connection, findReferences, tsLanguageService);
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
