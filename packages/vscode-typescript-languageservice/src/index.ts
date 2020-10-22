import * as ts from 'typescript';
import * as completions from './languageFeatures/completions';
import * as completionResolve from './languageFeatures/completionResolve';
import * as definitions from './languageFeatures/definitions';
import * as typeDefinitions from './languageFeatures/typeDefinitions';
import * as references from './languageFeatures/references';
import * as rename from './languageFeatures/rename';
import * as hover from './languageFeatures/hover';
import * as signatureHelp from './languageFeatures/signatureHelp';
import * as selectionRanges from './languageFeatures/selectionRanges';
import * as diagnostics from './languageFeatures/diagnostics';
import * as documentHighlight from './languageFeatures/documentHighlight';
import * as documentSymbol from './languageFeatures/documentSymbol';
import * as workspaceSymbols from './languageFeatures/workspaceSymbols';
import * as formatting from './languageFeatures/formatting';
import * as getSemanticTokens from './languageFeatures/semanticTokens';
import * as getFoldingRanges from './languageFeatures/foldingRanges';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { uriToFsPath } from '@volar/shared';

export { LanguageServiceHost } from 'typescript';
export type LanguageService = ReturnType<typeof createLanguageService>;
export { getSemanticTokenLegend } from './languageFeatures/semanticTokens';

export function createLanguageService(host: ts.LanguageServiceHost) {

	const documents = new Map<string, TextDocument>();
	const languageService = ts.createLanguageService(host);

	return {
		host,

		findDefinition: definitions.register(languageService, getTextDocument),
		findTypeDefinition: typeDefinitions.register(languageService, getTextDocument),
		findReferences: references.register(languageService, getTextDocument),
		doRename: rename.register(languageService, getTextDocument),

		findDocumentHighlights: documentHighlight.register(languageService),
		findDocumentSymbols: documentSymbol.register(languageService),
		findWorkspaceSymbols: workspaceSymbols.register(languageService),
		doComplete: completions.register(languageService),
		doCompletionResolve: completionResolve.register(languageService, getTextDocument),
		doHover: hover.register(languageService),
		doFormatting: formatting.register(languageService),
		getSignatureHelp: signatureHelp.register(languageService),
		getSelectionRange: selectionRanges.register(languageService),
		doValidation: diagnostics.register(languageService),
		getFoldingRanges: getFoldingRanges.register(languageService),
		getDocumentSemanticTokens: getSemanticTokens.register(languageService),
		getTextDocument,
		dispose,
	};

	function getTextDocument(uri: string) {
		const fileName = uriToFsPath(uri);
		const version = Number(host.getScriptVersion(fileName));
		if (!documents.has(uri) || documents.get(uri)!.version !== version) {
			const scriptSnapshot = host.getScriptSnapshot(fileName);
			if (scriptSnapshot) {
				const scriptText = scriptSnapshot.getText(0, scriptSnapshot.getLength());
				const document = TextDocument.create(uri, 'typescript', version, scriptText);
				documents.set(uri, document);
			}
		}
		return documents.get(uri);
	}
	function dispose() {
		languageService.dispose();
	}
}
