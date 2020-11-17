import * as ts from 'typescript';
import * as completions from './services/completions';
import * as completionResolve from './services/completionResolve';
import * as definitions from './services/definitions';
import * as typeDefinitions from './services/typeDefinitions';
import * as references from './services/references';
import * as rename from './services/rename';
import * as hover from './services/hover';
import * as signatureHelp from './services/signatureHelp';
import * as selectionRanges from './services/selectionRanges';
import * as diagnostics from './services/diagnostics';
import * as documentHighlight from './services/documentHighlight';
import * as documentSymbol from './services/documentSymbol';
import * as workspaceSymbols from './services/workspaceSymbols';
import * as formatting from './services/formatting';
import * as getSemanticTokens from './services/semanticTokens';
import * as getFoldingRanges from './services/foldingRanges';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { uriToFsPath } from '@volar/shared';

export { LanguageServiceHost } from 'typescript';
export type LanguageService = ReturnType<typeof createLanguageService>;
export { getSemanticTokenLegend } from './services/semanticTokens';

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
