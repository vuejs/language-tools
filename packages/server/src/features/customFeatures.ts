import * as shared from '@volar/shared';
import * as fs from 'fs';
import * as path from 'upath';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver';
import type { Projects } from '../projects';

export function register(
	connection: vscode.Connection,
	documents: vscode.TextDocuments<TextDocument>,
	getProjects: () => Projects | undefined,
) {
	connection.onRequest(shared.GetRefCompleteEditsRequest.type, handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;
		return getProjects()?.get(document.uri)?.service.__internal__.doRefAutoClose(document, handler.position);
	});
	connection.onRequest(shared.D3Request.type, async handler => {
		const document = documents.get(handler.uri);
		if (!document) return;
		return await getProjects()?.get(document.uri)?.service.__internal__.getD3(document);
	});
	connection.onRequest(shared.GetMatchTsConfigRequest.type, async handler => {
		const tsConfigs = getProjects()?.getTsConfigs(handler.uri);
		if (tsConfigs?.length) {
			return tsConfigs[0];
		}
	});
	connection.onNotification(shared.WriteVirtualFilesNotification.type, async ({ lsType }) => {

		const projects = getProjects();
		if (!projects) return;

		for (const [_, service] of projects.projects.size ? projects.projects : projects.inferredProjects) {
			const ls = service.getLanguageServiceDontCreate();
			if (!ls) continue;
			const localTypes = ls.__internal__.getLocalTypesFiles(lsType);
			for (const fileName of localTypes.fileNames) {
				fs.writeFile(fileName, localTypes.code, () => { });
			}
			const { sourceFiles } = await ls.__internal__.getContext();
			for (const [_, doc] of sourceFiles.getTsDocuments(lsType)) {
				fs.writeFile(shared.uriToFsPath(doc.uri), doc.getText(), () => { });
			}
		}
	});
	connection.onNotification(shared.VerifyAllScriptsNotification.type, async () => {

		const projects = getProjects();
		if (!projects) return;

		let errors = 0;
		let warnings = 0;

		const progress = await connection.window.createWorkDoneProgress();
		progress.begin('Verify', 0, '', true);
		for (const [_, service] of projects.projects.size ? projects.projects : projects.inferredProjects) {
			const ls = service.getLanguageServiceDontCreate();
			if (!ls) continue;
			const { sourceFiles } = await ls.__internal__.getContext();
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
		return getProjects()?.get(handler.uri)?.service.__internal__.detectTagNameCase(handler.uri);
	});
}
