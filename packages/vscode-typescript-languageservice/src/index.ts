import * as vscode from 'vscode-languageserver';
import * as completions from './services/completion';
import * as completions2 from './services/completion2';
import * as completionResolve from './services/completionResolve';
import * as definitions from './services/definition';
import * as typeDefinitions from './services/typeDefinition';
import * as references from './services/references';
import * as prepareRename from './services/prepareRename';
import * as rename from './services/rename';
import * as fileRename from './services/fileRename';
import * as codeActions from './services/codeAction';
import * as codeActionResolve from './services/codeActionResolve';
import * as hover from './services/hover';
import * as signatureHelp from './services/signatureHelp';
import * as selectionRanges from './services/selectionRanges';
import * as diagnostics from './services/diagnostics';
import * as documentHighlight from './services/documentHighlight';
import * as documentSymbol from './services/documentSymbol';
import * as workspaceSymbols from './services/workspaceSymbol';
import * as formatting from './services/formatting';
import * as semanticTokens from './services/semanticTokens';
import * as foldingRanges from './services/foldingRanges';
import * as callHierarchy from './services/callHierarchy';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as shared from '@volar/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';
export type LanguageService = ReturnType<typeof createLanguageService>;
export { getSemanticTokenLegend } from './services/semanticTokens';
export { getTriggerCharacters } from './services/completion';
import * as path from 'path';

export type LanguageServiceHost = ts.LanguageServiceHost & {
	getFormatOptions?(document: TextDocument, options?: vscode.FormattingOptions): Promise<ts.FormatCodeSettings>;
	getPreferences?(document: TextDocument): Promise<ts.UserPreferences>;
};

export function createLanguageService(ts: typeof import('typescript/lib/tsserverlibrary'), host: LanguageServiceHost, languageService: ts.LanguageService) {

	const documents = new Map<string, [string, TextDocument]>();

	return {
		findDefinition: definitions.register(languageService, getValidTextDocument, getTextDocument),
		findTypeDefinition: typeDefinitions.register(languageService, getValidTextDocument, getTextDocument),
		findReferences: references.register(languageService, getValidTextDocument, getTextDocument),
		prepareRename: prepareRename.register(languageService, getValidTextDocument),
		doRename: rename.register(languageService, getValidTextDocument, host),
		getEditsForFileRename: fileRename.register(languageService, getValidTextDocument, host),
		getCodeActions: codeActions.register(languageService, getValidTextDocument, host),
		doCodeActionResolve: codeActionResolve.register(languageService, getValidTextDocument, host),

		findDocumentHighlights: documentHighlight.register(languageService, getValidTextDocument, ts),
		findDocumentSymbols: documentSymbol.register(languageService, getValidTextDocument),
		findWorkspaceSymbols: workspaceSymbols.register(languageService, getValidTextDocument),
		doComplete: completions2.register(languageService, getValidTextDocument, host, ts),
		doCompletionResolve: completionResolve.register(languageService, getValidTextDocument, getTextDocument, host),
		doHover: hover.register(languageService, getValidTextDocument, getTextDocument, ts),
		doFormatting: formatting.register(languageService, getValidTextDocument, host),
		getSignatureHelp: signatureHelp.register(languageService, getValidTextDocument, ts),
		getSelectionRanges: selectionRanges.register(languageService, getValidTextDocument),
		doValidation: diagnostics.register(languageService, getValidTextDocument, ts),
		getFoldingRanges: foldingRanges.register(languageService, getValidTextDocument, ts),
		getDocumentSemanticTokens: semanticTokens.register(languageService, getValidTextDocument, ts),
		callHierarchy: callHierarchy.register(languageService, getValidTextDocument),

		dispose,

		__internal__: {
			host,
			raw: languageService,
			getTextDocument,
			getValidTextDocument,
			doCompleteSync: completions.register(languageService, getValidTextDocument, ts),
		},
	};

	function getValidTextDocument(uri: string) {
		const fileName = shared.uriToFsPath(uri);
		if (!languageService.getProgram()?.getSourceFile(fileName)) {
			return;
		}
		return getTextDocument(uri);
	}

	function getTextDocument(uri: string) {
		const fileName = shared.uriToFsPath(uri);
		const version = host.getScriptVersion(fileName);
		const oldDoc = documents.get(uri);
		if (!oldDoc || oldDoc[0] !== version) {
			const scriptSnapshot = host.getScriptSnapshot(fileName);
			if (scriptSnapshot) {
				const scriptText = scriptSnapshot.getText(0, scriptSnapshot.getLength());
				const document = TextDocument.create(uri, shared.syntaxToLanguageId(path.extname(uri).substr(1)), oldDoc ? oldDoc[1].version + 1 : 0, scriptText);
				documents.set(uri, [version, document]);
			}
		}
		return documents.get(uri)?.[1];
	}

	function dispose() {
		languageService.dispose();
	}
}
