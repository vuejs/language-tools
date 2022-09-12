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
export { getSemanticTokenLegend } from './services/semanticTokens';
export * from './configs/getFormatCodeSettings';
export * from './configs/getUserPreferences';

export interface GetConfiguration {
	(section: string, scopeUri: string): Promise<any>;
};

export function createLanguageService(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	host: ts.LanguageServiceHost,
	languageService: ts.LanguageService,
	getConfiguration: GetConfiguration,
	_rootUri: string,
) {

	const rootUri = URI.parse(_rootUri);
	const documents = shared.createUriMap<[string, TextDocument]>();

	return {
		findDefinition: definitions.register(rootUri, languageService, getValidTextDocument, getTextDocument),
		findTypeDefinition: typeDefinitions.register(rootUri, languageService, getValidTextDocument, getTextDocument),
		findReferences: references.register(rootUri, languageService, getValidTextDocument, getTextDocument),
		findFileReferences: fileReferences.register(rootUri, languageService, getValidTextDocument, getTextDocument),
		findImplementations: implementation.register(rootUri, languageService, getValidTextDocument, getTextDocument),
		prepareRename: prepareRename.register(languageService, getValidTextDocument),
		doRename: rename.register(rootUri, languageService, getValidTextDocument, getConfiguration),
		getEditsForFileRename: fileRename.register(rootUri, languageService, getValidTextDocument, getConfiguration),
		getCodeActions: codeActions.register(rootUri, languageService, getValidTextDocument, getConfiguration),
		doCodeActionResolve: codeActionResolve.register(rootUri, languageService, getValidTextDocument, getConfiguration),
		getInlayHints: inlayHints.register(languageService, getValidTextDocument, getConfiguration, ts),

		findDocumentHighlights: documentHighlight.register(languageService, getValidTextDocument, ts),
		findDocumentSymbols: documentSymbol.register(languageService, getValidTextDocument),
		findWorkspaceSymbols: workspaceSymbols.register(rootUri, languageService, getTextDocument),
		doComplete: completions.register(languageService, getValidTextDocument, getConfiguration, ts),
		doCompletionResolve: completionResolve.register(rootUri, languageService, getValidTextDocument, getTextDocument, getConfiguration),
		doDirectiveCommentComplete: directiveCommentCompletions.register(getValidTextDocument),
		doJsDocComplete: jsDocCompletions.register(languageService, getValidTextDocument),
		doHover: hover.register(rootUri, languageService, getValidTextDocument, getTextDocument, ts),
		doFormatting: formatting.register(languageService, getValidTextDocument, getConfiguration),
		getSignatureHelp: signatureHelp.register(languageService, getValidTextDocument, ts),
		getSelectionRanges: selectionRanges.register(languageService, getValidTextDocument),
		doValidation: diagnostics.register(rootUri, languageService, getValidTextDocument, ts),
		getFoldingRanges: foldingRanges.register(languageService, getValidTextDocument, ts),
		getDocumentSemanticTokens: semanticTokens.register(languageService, getValidTextDocument, ts),
		callHierarchy: callHierarchy.register(rootUri, languageService, getValidTextDocument),

		dispose,

		__internal__: {
			host,
			raw: languageService,
			getTextDocument,
			getValidTextDocument,
			isValidFile,
		},
	};

	function getValidTextDocument(uri: string) {
		const fileName = shared.getPathOfUri(uri);
		if (!isValidFile(fileName)) {
			return;
		}
		return getTextDocument(uri);
	}
	function isValidFile(fileName: string) {
		if (!languageService.getProgram()?.getSourceFile(fileName)) {
			return false;
		}
		return true;
	}
	function getTextDocument(uri: string) {
		const fileName = shared.getPathOfUri(uri);
		const version = host.getScriptVersion(fileName);
		const oldDoc = documents.uriGet(uri);
		if (!oldDoc || oldDoc[0] !== version) {
			const scriptSnapshot = host.getScriptSnapshot(fileName);
			if (scriptSnapshot) {
				const scriptText = scriptSnapshot.getText(0, scriptSnapshot.getLength());
				const document = TextDocument.create(uri, shared.syntaxToLanguageId(uri.substring(uri.lastIndexOf('.') + 1)), oldDoc ? oldDoc[1].version + 1 : 0, scriptText);
				documents.uriSet(uri, [version, document]);
			}
		}
		return documents.uriGet(uri)?.[1];
	}

	function dispose() {
		languageService.dispose();
	}
}
