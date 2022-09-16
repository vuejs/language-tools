import * as shared from '@volar/shared';
import * as path from 'upath';
import * as vscode from 'vscode-languageserver';
import type { Workspaces } from '../utils/workspaces';
import { GetMatchTsConfigRequest, ReloadProjectNotification, VerifyAllScriptsNotification, WriteVirtualFilesNotification } from '../requests';
import { LanguageServerPlugin } from '../types';

export function register(
	connection: vscode.Connection,
	projects: Workspaces,
	plugins: ReturnType<LanguageServerPlugin>[],
) {
	connection.onRequest(GetMatchTsConfigRequest.type, async params => {
		return (await projects.getProject(params.uri))?.tsconfig;
	});
	connection.onNotification(ReloadProjectNotification.type, async params => {
		projects.reloadProject();
	});
	connection.onNotification(WriteVirtualFilesNotification.type, async params => {

		const fs = await import('fs');
		const project = await projects.getProject(params.uri);

		if (project) {
			const ls = (await project.project)?.getLanguageServiceDontCreate();
			if (ls) {
				const sourceFiles = new Set(ls.context.host.getScriptFileNames());
				for (const virtualFile of ls.context.core.typescriptLanguageServiceHost.getScriptFileNames()) {
					if (virtualFile.startsWith(ls.context.host.getCurrentDirectory()) && !sourceFiles.has(virtualFile)) {
						const snapshot = ls.context.core.typescriptLanguageServiceHost.getScriptSnapshot(virtualFile);
						if (snapshot) {
							fs.writeFile(virtualFile, snapshot.getText(0, snapshot.getLength()), () => { });
						}
					}
				}
			}
		}
	});
	connection.onNotification(VerifyAllScriptsNotification.type, async params => {

		let errors = 0;
		let warnings = 0;

		const progress = await connection.window.createWorkDoneProgress();
		progress.begin('Verify', 0, '', true);

		const project = await projects.getProject(params.uri);
		if (project) {
			const ls = (await project.project)?.getLanguageServiceDontCreate();
			if (ls) {
				const allVueDocuments = ls.context.documents.getAll();
				let i = 0;
				for (const vueFile of allVueDocuments) {
					progress.report(i++ / allVueDocuments.length * 100, path.relative(ls.context.host.getCurrentDirectory(), shared.getPathOfUri(vueFile.uri)));
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

	for (const plugin of plugins) {
		plugin.languageService?.onInitialize?.(connection, getLanguageService as any);
	}

	async function getLanguageService(uri: string) {
		const project = (await projects.getProject(uri))?.project;
		return project?.getLanguageService();
	}
}
