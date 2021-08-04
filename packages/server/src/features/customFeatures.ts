import * as shared from '@volar/shared';
import * as fs from 'fs';
import * as path from 'upath';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver';
import type { ServicesManager } from '../servicesManager';

export function register(
	connection: vscode.Connection,
	documents: vscode.TextDocuments<TextDocument>,
	servicesManager: ServicesManager,
) {
	connection.onNotification(shared.RemoveAllRefSugars.type, async () => {

		for (const [_, handler] of servicesManager.services) {

			const ls = handler.getLanguageServiceDontCreate();
			if (!ls) continue;

			const progress = await connection.window.createWorkDoneProgress();
			progress.begin('Remove Ref Sugars', 0, '', true);

			const progress_2 = await connection.window.createWorkDoneProgress();
			progress_2.begin('Find Ref Sugar References', 0, '', true);

			const { sourceFiles } = ls.__internal__.getContext();
			const sourceFiles_2 = sourceFiles.getAll();
			const workspaceEdit: vscode.WorkspaceEdit = { changes: {} };

			for (let i = 0; i < sourceFiles_2.length; i++) {

				if (progress.token.isCancellationRequested)
					break;

				const sourceFile = sourceFiles_2[i];
				progress.report(i / sourceFiles_2.length * 100, path.relative(ls.__internal__.rootPath, shared.uriToFsPath(sourceFile.uri)));
				const edits = await ls.__internal__.getUnrefSugarEdits(sourceFile.uri, progress_2);

				if (edits.length) {
					workspaceEdit.changes![sourceFile.uri] = edits;
				}
			}

			connection.workspace.applyEdit(workspaceEdit)

			progress_2.done();
			progress.done();
		}
	});
	connection.onNotification(shared.RestartServerNotification.type, async () => {
		servicesManager.restartAll();
	});
	connection.onRequest(shared.GetRefCompleteEditsRequest.type, handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;
		return servicesManager.getMatchService(document.uri)?.__internal__.doRefAutoClose(document, handler.position);
	});
	connection.onRequest(shared.D3Request.type, handler => {
		const document = documents.get(handler.uri);
		if (!document) return;
		return servicesManager.getMatchService(document.uri)?.__internal__.getD3(document);
	});
	connection.onNotification(shared.WriteVirtualFilesNotification.type, async ({ lsType }) => {
		for (const [_, service] of servicesManager.services) {
			const ls = service.getLanguageServiceDontCreate();
			if (!ls) continue;
			const globalDocs = ls.__internal__.getGlobalDocs();
			for (const globalDoc of globalDocs) {
				fs.writeFile(shared.uriToFsPath(globalDoc.uri), globalDoc.getText(), () => { });
			}
			const { sourceFiles } = ls.__internal__.getContext();
			for (const [_, doc] of sourceFiles.getTsDocuments(lsType)) {
				fs.writeFile(shared.uriToFsPath(doc.uri), doc.getText(), () => { });
			}
		}
	});
	connection.onNotification(shared.VerifyAllScriptsNotification.type, async () => {

		let errors = 0;
		let warnings = 0;

		const progress = await connection.window.createWorkDoneProgress();
		progress.begin('Verify', 0, '', true);
		for (const [_, service] of servicesManager.services) {
			const ls = service.getLanguageServiceDontCreate();
			if (!ls) continue;
			const { sourceFiles } = ls.__internal__.getContext();
			const allFiles = sourceFiles.getAll();
			let i = 0;
			for (const sourceFile of allFiles) {
				progress.report(i++ / allFiles.length * 100, path.relative(ls.__internal__.rootPath, shared.uriToFsPath(sourceFile.uri)));
				if (progress.token.isCancellationRequested) {
					continue;
				}
				let _result: vscode.Diagnostic[] = [];
				await ls.doValidation(sourceFile.uri, result => {
					connection.sendDiagnostics({ uri: sourceFile.uri, diagnostics: result });
					_result = result;
				});
				errors += _result.filter(error => error.severity === vscode.DiagnosticSeverity.Error).length;
				warnings += _result.filter(error => error.severity === vscode.DiagnosticSeverity.Warning).length;
			}
		}
		progress.done();

		connection.window.showInformationMessage(`Verification complete. Found ${errors} errors and ${warnings} warnings.`);
	});
	connection.onRequest(shared.DetectDocumentNameCasesRequest.type, handler => {
		return servicesManager.getMatchService(handler.uri)?.__internal__.detectTagNameCase(handler.uri);
	});
}
