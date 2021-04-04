import * as ShPlugin from 'typescript-vscode-sh-plugin';
import * as completions from './services/completions';
import * as completionResolve from './services/completionResolve';
import * as definitions from './services/definitions';
import * as typeDefinitions from './services/typeDefinitions';
import * as references from './services/references';
import * as prepareRename from './services/prepareRename';
import * as rename from './services/rename';
import * as fileRename from './services/fileRename';
import * as codeActions from './services/codeActions';
import * as codeActionResolve from './services/codeActionResolve';
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
export type { LanguageServiceHost } from 'typescript';
import type { LanguageServiceHost } from 'typescript';
export type LanguageService = ReturnType<typeof createLanguageService>;
export { getSemanticTokenLegend } from './services/semanticTokens';

export function createLanguageService(host: LanguageServiceHost, ts: typeof import('typescript')) {

	const documents = new Map<string, [string, TextDocument]>();
	const shPlugin = ShPlugin({ typescript: ts as any });
	let languageService = ts.createLanguageService(host);
	languageService = shPlugin.decorate(languageService);

	return {
		raw: languageService,
		host,

		findDefinition: definitions.register(languageService, getTextDocument),
		findTypeDefinition: typeDefinitions.register(languageService, getTextDocument),
		findReferences: references.register(languageService, getTextDocument),
		prepareRename: prepareRename.register(languageService, getTextDocument),
		doRename: rename.register(languageService, getTextDocument),
		onFileName: fileRename.register(languageService, getTextDocument),
		getCodeActions: codeActions.register(languageService, getTextDocument),
		doCodeActionResolve: codeActionResolve.register(languageService, getTextDocument),

		findDocumentHighlights: documentHighlight.register(languageService, getTextDocument, ts),
		findDocumentSymbols: documentSymbol.register(languageService, getTextDocument),
		findWorkspaceSymbols: workspaceSymbols.register(languageService, getTextDocument),
		doComplete: completions.register(languageService, getTextDocument, host.getCurrentDirectory()),
		doCompletionResolve: completionResolve.register(languageService, getTextDocument, ts),
		doHover: hover.register(languageService, getTextDocument, ts),
		doFormatting: formatting.register(languageService, getTextDocument),
		getSignatureHelp: signatureHelp.register(languageService, getTextDocument, ts),
		getSelectionRange: selectionRanges.register(languageService, getTextDocument),
		doValidation: diagnostics.register(languageService, getTextDocument, ts),
		getFoldingRanges: foldingRanges.register(languageService, getTextDocument, ts),
		getDocumentSemanticTokens: semanticTokens.register(languageService, getTextDocument),
		...callHierarchy.register(languageService, getTextDocument),

		getTextDocument: getTextDocumentNoChecking,
		getTextDocument2: getTextDocument,
		dispose,
	};

	function getTextDocument(uri: string) {
		const fileName = uriToFsPath(uri);
		if (!languageService.getProgram()?.getSourceFile(fileName)) {
			return;
		}
		return getTextDocumentNoChecking(uri);
	}
	function getTextDocumentNoChecking(uri: string) {
		const fileName = uriToFsPath(uri);
		const version = host.getScriptVersion(fileName);
		const oldDoc = documents.get(uri);
		if (!oldDoc || oldDoc[0] !== version) {
			const scriptSnapshot = host.getScriptSnapshot(fileName);
			if (scriptSnapshot) {
				const scriptText = scriptSnapshot.getText(0, scriptSnapshot.getLength());
				const document = TextDocument.create(uri, uri.endsWith('.vue') ? 'vue' : 'typescript', oldDoc ? oldDoc[1].version + 1 : 0, scriptText);
				documents.set(uri, [version, document]);
			}
		}
		return documents.get(uri)?.[1];
	}
	function dispose() {
		languageService.dispose();
	}
}
