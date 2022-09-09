import * as shared from '@volar/shared';
import * as path from 'upath';
import * as vscode from 'vscode-languageserver';
import type { Workspaces } from '../utils/workspaces';
import * as vue from '@volar/vue-language-core';
import { DetectDocumentNameCasesRequest, GetMatchTsConfigRequest, ReloadProjectNotification, VerifyAllScriptsNotification, WriteVirtualFilesNotification } from '../requests';

export function register(
	connection: vscode.Connection,
	projects: Workspaces,
) {
	connection.onRequest(GetMatchTsConfigRequest.type, async handler => {
		return (await projects.getProject(handler.uri))?.tsconfig;
	});
	connection.onNotification(ReloadProjectNotification.type, async handler => {
		projects.reloadProject();
	});
	connection.onNotification(WriteVirtualFilesNotification.type, async (params) => {

		const fs = await import('fs');

		const project = await projects.getProject(params.uri);
		if (project) {
			const ls = await (await project.project)?.getLanguageServiceDontCreate();
			if (ls) {
				const localTypesFiles = ls.__internal__.vueRuntimeContext.typescriptLanguageServiceHost.getScriptFileNames().filter(fileName => fileName.endsWith(vue.localTypes.typesFileName));
				for (const fileName of localTypesFiles) {
					const script = ls.__internal__.vueRuntimeContext.typescriptLanguageServiceHost.getScriptSnapshot(fileName);
					if (script) {
						fs.writeFile(fileName, script.getText(0, script.getLength()), () => { });
					}
				}
				const context = ls.__internal__.context;
				for (const vueDocument of context.documents.getAll()) {
					for (const sourceMap of vueDocument.getSourceMaps()) {

						if (!sourceMap.embeddedFile.isTsHostFile)
							continue;

						fs.writeFile(sourceMap.embeddedFile.fileName, sourceMap.mappedDocument.getText(), () => { });
					}
				}
			}
		}
	});
	connection.onNotification(VerifyAllScriptsNotification.type, async (params) => {

		let errors = 0;
		let warnings = 0;

		const progress = await connection.window.createWorkDoneProgress();
		progress.begin('Verify', 0, '', true);

		const project = await projects.getProject(params.uri);
		if (project) {
			const ls = await (await project.project)?.getLanguageServiceDontCreate();
			if (ls) {
				const context = ls.__internal__.context;
				const allVueDocuments = context.documents.getAll();
				let i = 0;
				for (const vueFile of allVueDocuments) {
					progress.report(i++ / allVueDocuments.length * 100, path.relative(ls.__internal__.rootPath, shared.getPathOfUri(vueFile.uri)));
					if (progress.token.isCancellationRequested) {
						continue;
					}
					let _result = await ls.doValidation(vueFile.uri);
					connection.sendDiagnostics({ uri: vueFile.uri, diagnostics: _result });
					errors += _result.filter(error => error.severity === vscode.DiagnosticSeverity.Error).length;
					warnings += _result.filter(error => error.severity === vscode.DiagnosticSeverity.Warning).length;
				}
			}
		}

		progress.done();

		connection.window.showInformationMessage(`Verification complete. Found ${errors} errors and ${warnings} warnings.`);
	});
	connection.onRequest(DetectDocumentNameCasesRequest.type, async handler => {
		const languageService = await getLanguageService(handler.uri);
		return languageService?.__internal__.detectTagNameCase(handler.uri);
	});

	async function getLanguageService(uri: string) {
		const project = (await projects.getProject(uri))?.project;
		return project?.getLanguageService();
	}
}
