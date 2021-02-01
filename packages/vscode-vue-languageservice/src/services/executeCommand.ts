import type { TsApiRegisterOptions } from '../types';
import type { Connection } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { Commands } from '../commands';
import { register as registerFindReferences } from './references';
import { execute as executeShowReferences } from '../commands/showReferences';
import { execute as executeHtmlToPug } from '../commands/htmlToPug';
import { execute as executePugToHtml } from '../commands/pugToHtml';
import { execute as executeUseRefSugar } from '../commands/useRefSugar';
import { execute as executeUnuseRefSugar } from '../commands/unuseRefSugar';

export function register({ sourceFiles, tsLanguageService }: TsApiRegisterOptions) {

	const findReferences = registerFindReferences(arguments[0]);

	return async (document: TextDocument, command: string, args: any[] | undefined, connection: Connection) => {

		if (command === Commands.SHOW_REFERENCES && args) {
			executeShowReferences(args[0], args[1], args[2], connection);
		}

		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile)
			return;

		if (command === Commands.SWITCH_REF_SUGAR) {

			const desc = sourceFile.getDescriptor();
			if (!desc.scriptSetup)
				return;

			const scriptSetupData = sourceFile.getScriptSetupData();
			if (!scriptSetupData)
				return;

			if (scriptSetupData.labels.length) {
				executeUseRefSugar(document, sourceFile, connection, findReferences, tsLanguageService);
			}
			else {
				executeUnuseRefSugar(document, sourceFile, connection, findReferences);
			}
		}
		if (command === Commands.HTML_TO_PUG) {
			executeHtmlToPug(document, sourceFile, connection);
		}
		if (command === Commands.PUG_TO_HTML) {
			executePugToHtml(document, sourceFile, connection);
		}
	}
}
