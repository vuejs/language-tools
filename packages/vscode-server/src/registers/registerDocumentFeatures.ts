import * as vscode from 'vscode-languageserver';
import {
	allFilesReg,
	vueFileReg
} from '../features/shared';

export function register(connection: vscode.Connection, legend: vscode.SemanticTokensLegend) {
	connection.client.register(vscode.DocumentHighlightRequest.type, vueFileReg);
	connection.client.register(vscode.DocumentSymbolRequest.type, vueFileReg);
	connection.client.register(vscode.DocumentLinkRequest.type, vueFileReg);
	connection.client.register(vscode.DocumentColorRequest.type, vueFileReg);
	connection.client.register(vscode.CodeLensRequest.type, {
		documentSelector: allFilesReg.documentSelector,
		resolveProvider: true,
	});
	connection.client.register(vscode.SemanticTokensRegistrationType.type, {
		documentSelector: vueFileReg.documentSelector,
		range: true,
		full: false,
		legend,
	});
	connection.client.register(vscode.CodeActionRequest.type, {
		documentSelector: vueFileReg.documentSelector,
		codeActionKinds: [
			vscode.CodeActionKind.Empty,
			vscode.CodeActionKind.QuickFix,
			vscode.CodeActionKind.Refactor,
			vscode.CodeActionKind.RefactorExtract,
			vscode.CodeActionKind.RefactorInline,
			vscode.CodeActionKind.RefactorRewrite,
			vscode.CodeActionKind.Source,
			vscode.CodeActionKind.SourceFixAll,
			vscode.CodeActionKind.SourceOrganizeImports,
		],
		resolveProvider: true,
	});
}
