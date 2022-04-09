import * as shared from '@volar/shared';
import * as path from 'upath';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver';
import type { Projects } from '../projects';

export function register(
	connection: vscode.Connection,
	documents: vscode.TextDocuments<TextDocument>,
	getProjects: () => Projects | undefined,
) {
	connection.onRequest(shared.D3Request.type, async handler => {
		// const document = documents.get(handler.uri);
		// if (!document) return;
		// const languageService = await getLanguageService(document.uri);
		// return languageService?.__internal__.getD3(document);
		return undefined; // disable for now
	});
	connection.onRequest(shared.GetMatchTsConfigRequest.type, async handler => {
		const projects = getProjects();
		return (await projects?.getProject(handler.uri))?.tsconfig;
	});
	connection.onNotification(shared.WriteVirtualFilesNotification.type, async () => {

		const projects = getProjects();
		if (!projects) return;

		for (const workspace of projects.workspaces.values()) {
			for (const project of [...workspace.projects.values(), workspace.getInferredProjectDontCreate()].filter(shared.notEmpty)) {
				const ls = await (await project).getLanguageServiceDontCreate();
				if (!ls) continue;
				const localTypes = ls.__internal__.tsRuntime.getLocalTypesFiles();
				for (const fileName of localTypes.fileNames) {
					connection.workspace.applyEdit({
						edit: {
							documentChanges: [
								vscode.CreateFile.create(shared.fsPathToUri(fileName)),
								vscode.TextDocumentEdit.create(
									vscode.OptionalVersionedTextDocumentIdentifier.create(shared.fsPathToUri(fileName), null),
									[{ range: vscode.Range.create(0, 0, 0, 0), newText: localTypes.code }],
								),
							]
						}
					});
				}
				const context = await ls.__internal__.getContext();
				for (const vueDocument of context.vueDocuments.getAll()) {
					for (const sourceMap of vueDocument.getSourceMaps()) {

						const isTsFile = sourceMap.embeddedFile.fileName.endsWith('.js') ||
							sourceMap.embeddedFile.fileName.endsWith('.ts') ||
							sourceMap.embeddedFile.fileName.endsWith('.jsx') ||
							sourceMap.embeddedFile.fileName.endsWith('.tsx')

						if (!isTsFile)
							continue;

						connection.workspace.applyEdit({
							edit: {
								documentChanges: [
									vscode.CreateFile.create(sourceMap.mappedDocument.uri),
									vscode.TextDocumentEdit.create(
										vscode.OptionalVersionedTextDocumentIdentifier.create(sourceMap.mappedDocument.uri, null),
										[{ range: vscode.Range.create(0, 0, 0, 0), newText: sourceMap.mappedDocument.getText() }],
									),
								]
							}
						});
					}
				}
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

		for (const workspace of projects.workspaces.values()) {
			for (const project of [...workspace.projects.values(), workspace.getInferredProjectDontCreate()].filter(shared.notEmpty)) {
				const ls = await (await project).getLanguageServiceDontCreate();
				if (!ls) continue;
				const context = await ls.__internal__.getContext();
				const allVueDocuments = context.vueDocuments.getAll();
				let i = 0;
				for (const vueFile of allVueDocuments) {
					progress.report(i++ / allVueDocuments.length * 100, path.relative(ls.__internal__.rootPath, shared.uriToFsPath(vueFile.uri)));
					if (progress.token.isCancellationRequested) {
						continue;
					}
					let _result: vscode.Diagnostic[] = [];
					await ls.doValidation(vueFile.uri, result => {
						connection.sendDiagnostics({ uri: vueFile.uri, diagnostics: result });
						_result = result;
					});
					errors += _result.filter(error => error.severity === vscode.DiagnosticSeverity.Error).length;
					warnings += _result.filter(error => error.severity === vscode.DiagnosticSeverity.Warning).length;
				}
			}
		}

		progress.done();

		connection.window.showInformationMessage(`Verification complete. Found ${errors} errors and ${warnings} warnings.`);
	});
	connection.onRequest(shared.DetectDocumentNameCasesRequest.type, async handler => {
		const languageService = await getLanguageService(handler.uri);
		return languageService?.__internal__.detectTagNameCase(handler.uri);
	});

	async function getLanguageService(uri: string) {
		const projects = await getProjects();
		const project = (await projects?.getProject(uri))?.project;
		return project?.getLanguageService();
	}
}
