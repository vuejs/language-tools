import type * as ts from 'typescript/lib/tsserverlibrary';
import * as vscode from 'vscode-languageserver-protocol';
import * as shared from '@volar/shared';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined, ts: typeof import('typescript/lib/tsserverlibrary')) {
	return (uri: string, position: vscode.Position, context?: vscode.SignatureHelpContext): vscode.SignatureHelp | undefined => {
		const document = getTextDocument(uri);
		if (!document) return;

		const options: ts.SignatureHelpItemsOptions = {};
		if (context?.triggerKind === vscode.SignatureHelpTriggerKind.Invoked) {
			options.triggerReason = {
				kind: 'invoked'
			};
		}
		else if (context?.triggerKind === vscode.SignatureHelpTriggerKind.TriggerCharacter) {
			options.triggerReason = {
				kind: 'characterTyped',
				triggerCharacter: context.triggerCharacter as ts.SignatureHelpTriggerCharacter,
			};
		}
		else if (context?.triggerKind === vscode.SignatureHelpTriggerKind.ContentChange) {
			options.triggerReason = {
				kind: 'retrigger',
				triggerCharacter: context.triggerCharacter as ts.SignatureHelpRetriggerCharacter,
			};
		}

		const fileName = shared.uriToFileName(document.uri);
		const offset = document.offsetAt(position);

		let helpItems: ReturnType<typeof languageService.getSignatureHelpItems> | undefined;
		try { helpItems = languageService.getSignatureHelpItems(fileName, offset, options); } catch { }
		if (!helpItems) return;

		return {
			activeSignature: helpItems.selectedItemIndex,
			activeParameter: helpItems.argumentIndex,
			signatures: helpItems.items.map(item => {
				const signature: vscode.SignatureInformation = {
					label: '',
					documentation: undefined,
					parameters: []
				};
				signature.label += ts.displayPartsToString(item.prefixDisplayParts);
				item.parameters.forEach((p, i, a) => {
					const label = ts.displayPartsToString(p.displayParts);
					const parameter: vscode.ParameterInformation = {
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
