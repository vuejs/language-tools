import * as ts from 'typescript';
import {
	SignatureHelp,
	SignatureInformation,
	ParameterInformation,
	TextDocument,
	Position,
} from 'vscode-languageserver/node';
import { uriToFsPath } from '@volar/shared';

export function register(languageService: ts.LanguageService) {
	return (document: TextDocument, position: Position): SignatureHelp | undefined => {
		const fileName = uriToFsPath(document.uri);
		const offset = document.offsetAt(position);
		const helpItems = languageService.getSignatureHelpItems(fileName, offset, undefined);
		if (!helpItems) return;

		return {
			activeSignature: helpItems.selectedItemIndex,
			activeParameter: helpItems.argumentIndex,
			signatures: helpItems.items.map(item => {
				const signature: SignatureInformation = {
					label: '',
					documentation: undefined,
					parameters: []
				};
				signature.label += ts.displayPartsToString(item.prefixDisplayParts);
				item.parameters.forEach((p, i, a) => {
					const label = ts.displayPartsToString(p.displayParts);
					const parameter: ParameterInformation = {
						label,
						documentation: ts.displayPartsToString(p.documentation)
					};
					signature.label += label;
					signature.parameters!.push(parameter);
					if (i < a.length - 1) {
						signature.label += ts.displayPartsToString(item.separatorDisplayParts);
					}
				});
				signature.label += ts.displayPartsToString(item.suffixDisplayParts);
				return signature;
			}),
		};
	};
}
