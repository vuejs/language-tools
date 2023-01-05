import * as completions from './services/completions/basic';
import * as directiveCommentCompletions from './services/completions/directiveComment';
import * as jsDocCompletions from './services/completions/jsDoc';
import * as completionResolve from './services/completions/resolve';
import * as definitions from './services/definition';
import * as typeDefinitions from './services/typeDefinition';
import * as references from './services/references';
import * as fileReferences from './services/fileReferences';
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
import * as implementation from './services/implementation';
import * as inlayHints from './services/inlayHints';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as shared from '@volar/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { URI } from 'vscode-uri';
import * as _ from 'vscode-languageserver-protocol';

export interface LanguageService extends ReturnType<typeof createLanguageService> { }
export * from './configs/getFormatCodeSettings';
export * from './configs/getUserPreferences';

export interface GetConfiguration {
	<T = any>(section: string): Promise<T | undefined>;
};

export function createLanguageService(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	host: ts.LanguageServiceHost,
	languageService: ts.LanguageService,
	getConfiguration: GetConfiguration,
	rootUri: URI,
) {

	const documents = new Map<string, [string, TextDocument]>();

	return {
		findDefinition: definitions.register(languageService, getTextDocument),
		findTypeDefinition: typeDefinitions.register(languageService, getTextDocument),
		findReferences: references.register(languageService, getTextDocument),
		findFileReferences: fileReferences.register(languageService, getTextDocument),
		findImplementations: implementation.register(languageService, getTextDocument),
		prepareRename: prepareRename.register(languageService, getTextDocument),
		doRename: rename.register(rootUri, languageService, getTextDocument, getConfiguration),
		getEditsForFileRename: fileRename.register(rootUri, languageService, getTextDocument, getConfiguration),
		getCodeActions: codeActions.register(rootUri, languageService, getTextDocument, getConfiguration),
		doCodeActionResolve: codeActionResolve.register(rootUri, languageService, getTextDocument, getConfiguration),
		getInlayHints: inlayHints.register(rootUri, languageService, getTextDocument, getConfiguration, ts),

		findDocumentHighlights: documentHighlight.register(languageService, getTextDocument, ts),
		findDocumentSymbols: documentSymbol.register(languageService, getTextDocument),
		findWorkspaceSymbols: workspaceSymbols.register(languageService, getTextDocument),
		doComplete: completions.register(rootUri, languageService, getTextDocument, getConfiguration, ts),
		doCompletionResolve: completionResolve.register(rootUri, languageService, getTextDocument, getConfiguration),
		doDirectiveCommentComplete: directiveCommentCompletions.register(getTextDocument),
		doJsDocComplete: jsDocCompletions.register(languageService, getTextDocument),
		doHover: hover.register(languageService, getTextDocument, ts),
		doFormatting: formatting.register(languageService, getTextDocument, getConfiguration),
		getSignatureHelp: signatureHelp.register(languageService, getTextDocument, ts),
		getSelectionRanges: selectionRanges.register(languageService, getTextDocument),
		doValidation: diagnostics.register(host, languageService, getTextDocument, ts),
		getFoldingRanges: foldingRanges.register(languageService, getTextDocument, ts),
		getDocumentSemanticTokens: semanticTokens.register(host, languageService, getTextDocument, ts),
		callHierarchy: callHierarchy.register(languageService, getTextDocument),
	};

	function getTextDocument(uri: string) {
		const fileName = shared.getPathOfUri(uri);
		const version = host.getScriptVersion(fileName);
		const oldDoc = documents.get(uri);
		if (!oldDoc || oldDoc[0] !== version) {
			const scriptSnapshot = host.getScriptSnapshot(fileName);
			if (scriptSnapshot) {
				const scriptText = scriptSnapshot.getText(0, scriptSnapshot.getLength());
				const document = TextDocument.create(uri, shared.syntaxToLanguageId(uri.substring(uri.lastIndexOf('.') + 1)), oldDoc ? oldDoc[1].version + 1 : 0, scriptText);
				documents.set(uri, [version, document]);
			}
		}
		return documents.get(uri)?.[1];
	}
}
