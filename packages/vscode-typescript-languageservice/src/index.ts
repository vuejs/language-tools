import * as ts from 'typescript';
import * as tsLib from 'typescript/lib/tsserverlibrary';
import * as ShPlugin from 'typescript-vscode-sh-plugin';
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
import * as semanticTokens from './services/semanticTokens';
import * as foldingRanges from './services/foldingRanges';
import * as callHierarchy from './services/callHierarchy';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { uriToFsPath } from '@volar/shared';

const shPlugin = ShPlugin({ typescript: tsLib });

export { LanguageServiceHost } from 'typescript';
export type LanguageService = ReturnType<typeof createLanguageService>;
export { getSemanticTokenLegend } from './services/semanticTokens';
export { setMode as setDiagnosticMode } from './services/diagnostics'

export function createLanguageService(host: ts.LanguageServiceHost) {

	const documents = new Map<string, TextDocument>();
	let languageService = ts.createLanguageService(host);
	languageService = shPlugin.decorate(languageService);

	return {
		host,

		findDefinition: definitions.register(languageService, getTextDocument),
		findTypeDefinition: typeDefinitions.register(languageService, getTextDocument),
		findReferences: references.register(languageService, getTextDocument),
		doRename: rename.register(languageService, getTextDocument),

		findDocumentHighlights: documentHighlight.register(languageService, getTextDocument),
		findDocumentSymbols: documentSymbol.register(languageService, getTextDocument),
		findWorkspaceSymbols: workspaceSymbols.register(languageService, getTextDocument),
		doComplete: completions.register(languageService, getTextDocument),
		doCompletionResolve: completionResolve.register(languageService, getTextDocument),
		doHover: hover.register(languageService, getTextDocument),
		doFormatting: formatting.register(languageService, getTextDocument),
		getSignatureHelp: signatureHelp.register(languageService, getTextDocument),
		getSelectionRange: selectionRanges.register(languageService, getTextDocument),
		doValidation: diagnostics.register(languageService, getTextDocument),
		getFoldingRanges: foldingRanges.register(languageService, getTextDocument),
		getDocumentSemanticTokens: semanticTokens.register(languageService, getTextDocument),
		...callHierarchy.register(languageService, getTextDocument),

		getTextDocument,
		dispose,
	};

	function getTextDocument(uri: string) {
		const fileName = uriToFsPath(uri);
		if (!languageService.getProgram()?.getSourceFile(fileName)) {
			return;
		}
		const version = Number(host.getScriptVersion(fileName));
		if (!documents.has(uri) || documents.get(uri)!.version !== version) {
			const scriptSnapshot = host.getScriptSnapshot(fileName);
			if (scriptSnapshot) {
				const scriptText = scriptSnapshot.getText(0, scriptSnapshot.getLength());
				const document = TextDocument.create(uri, uri.endsWith('.vue') ? 'vue' : 'typescript', version, scriptText);
				documents.set(uri, document);
			}
		}
		return documents.get(uri);
	}
	function dispose() {
		languageService.dispose();
	}
}
