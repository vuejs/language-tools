import * as shared from '@volar/shared';
import * as path from 'upath';
import * as vscode from 'vscode-languageserver';
import type { Projects } from '../projects';
import * as vue from '@volar/vue-language-core';

export function register(
	connection: vscode.Connection,
	projects: Projects,
) {
	connection.onRequest(shared.D3Request.type, async handler => {
		// const document = documents.get(handler.uri);
		// if (!document) return;
		// const languageService = await getLanguageService(document.uri);
		// return languageService?.__internal__.getD3(document);
		return undefined; // disable for now
	});
	connection.onRequest(shared.GetMatchTsConfigRequest.type, async handler => {
		return (await projects.getProject(handler.uri))?.tsconfig;
	});
	connection.onNotification(shared.ReloadProjectNotification.type, async handler => {
		projects.reloadProject(handler.uri);
	});
	connection.onNotification(shared.WriteVirtualFilesNotification.type, async () => {

		const fs = await import('fs');

		for (const workspace of projects.workspaces.values()) {
			for (const project of [...workspace.projects.values(), workspace.getInferredProjectDontCreate()].filter(shared.notEmpty)) {
				const ls = await (await project).getLanguageServiceDontCreate();
				if (!ls) continue;
				const localTypesFiles = ls.__internal__.vueRuntimeContext.typescriptLanguageServiceHost.getScriptFileNames().filter(fileName => fileName.endsWith(vue.localTypes.typesFileName));
				for (const fileName of localTypesFiles) {
					const script = ls.__internal__.vueRuntimeContext.typescriptLanguageServiceHost.getScriptSnapshot(fileName);
					if (script) {
						fs.writeFile(fileName, script.getText(0, script.getLength()), () => { });
					}
				}
				const context = await ls.__internal__.getContext();
				for (const vueDocument of context.vueDocuments.getAll()) {
					for (const sourceMap of vueDocument.getSourceMaps()) {

						if (!sourceMap.embeddedFile.isTsHostFile)
							continue;

						fs.writeFile(sourceMap.embeddedFile.fileName, sourceMap.mappedDocument.getText(), () => { });
					}
				}
			}
		}
	});
	connection.onNotification(shared.VerifyAllScriptsNotification.type, async () => {

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
	connection.onRequest(shared.DetectDocumentNameCasesRequest.type, async handler => {
		const languageService = await getLanguageService(handler.uri);
		return languageService?.__internal__.detectTagNameCase(handler.uri);
	});

	async function getLanguageService(uri: string) {
		const project = (await projects.getProject(uri))?.project;
		return project?.getLanguageService();
	}
}
