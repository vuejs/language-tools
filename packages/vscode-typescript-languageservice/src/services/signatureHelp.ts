import type * as ts from 'typescript';
import {
	SignatureHelp,
	SignatureInformation,
	ParameterInformation,
	Position,
	SignatureHelpContext,
	SignatureHelpTriggerKind,
} from 'vscode-languageserver/node';
import { uriToFsPath } from '@volar/shared';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined, ts: typeof import('typescript/lib/tsserverlibrary')) {
	return (uri: string, position: Position, context?: SignatureHelpContext): SignatureHelp | undefined => {
		const document = getTextDocument(uri);
		if (!document) return;

		const options: ts.SignatureHelpItemsOptions = {};
		if (context?.triggerKind === SignatureHelpTriggerKind.Invoked) {
			options.triggerReason = {
				kind: 'invoked'
			};
		}
		else if (context?.triggerKind === SignatureHelpTriggerKind.TriggerCharacter) {
			options.triggerReason = {
				kind: 'characterTyped',
				triggerCharacter: context.triggerCharacter as ts.SignatureHelpTriggerCharacter,
			};
		}
		else if (context?.triggerKind === SignatureHelpTriggerKind.ContentChange) {
			options.triggerReason = {
				kind: 'retrigger',
				triggerCharacter: context.triggerCharacter as ts.SignatureHelpRetriggerCharacter,
			};
		}

		const fileName = uriToFsPath(document.uri);
		const offset = document.offsetAt(position);
		const helpItems = languageService.getSignatureHelpItems(fileName, offset, options);
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
