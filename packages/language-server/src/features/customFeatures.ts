import * as shared from '@volar/shared';
import * as path from 'typesafe-path';
import * as vscode from 'vscode-languageserver';
import type { Workspaces } from '../utils/workspaces';
import { GetMatchTsConfigRequest, ReloadProjectNotification, VerifyAllScriptsNotification, WriteVirtualFilesNotification, GetVirtualFileNamesRequest, GetVirtualFileRequest, ReportStats } from '../protocol';
import { forEachEmbeddeds } from '@volar/language-core';

export function register(
	connection: vscode.Connection,
	projects: Workspaces,
) {
	connection.onNotification(ReportStats.type, async () => {
		for (const [rootUri, _workspace] of projects.workspaces) {

			connection.console.log('workspace: ' + rootUri);
			const workspace = await _workspace;

			connection.console.log('documentRegistry stats: ' + workspace.documentRegistry.reportStats());
			connection.console.log('');

			connection.console.log('tsconfig: inferred');
			const _inferredProject = workspace.getInferredProjectDontCreate();
			if (_inferredProject) {
				connection.console.log('loaded: true');
				const inferredProject = await _inferredProject;
				connection.console.log('largest 10 files:');
				for (const script of [...inferredProject.scripts.values()]
					.sort((a, b) => (b.snapshot?.getLength() ?? 0) - (a.snapshot?.getLength() ?? 0))
					.slice(0, 10)
				) {
					connection.console.log('  - ' + script.fileName);
					connection.console.log(`    size: ${script.snapshot?.getLength()}`);
				}
				connection.console.log('files:');
				for (const script of inferredProject.scripts.values()) {
					connection.console.log('  - ' + script.fileName);
					connection.console.log(`    size: ${script.snapshot?.getLength()}`);
					connection.console.log(`    ref counts: "${(workspace.documentRegistry as any).getLanguageServiceRefCounts?.(script.fileName, inferredProject.languageServiceHost.getScriptKind?.(script.fileName))})"`);
				}
			}
			else {
				connection.console.log('loaded: false');
			}
			connection.console.log('');

			for (const _project of workspace.projects.values()) {
				const project = await _project;
				connection.console.log('tsconfig: ' + project.tsConfig);
				connection.console.log('loaded: ' + !!project.getLanguageServiceDontCreate());
				connection.console.log('largest 10 files:');
				for (const script of [...project.scripts.values()]
					.sort((a, b) => (b.snapshot?.getLength() ?? 0) - (a.snapshot?.getLength() ?? 0))
					.slice(0, 10)
				) {
					connection.console.log('  - ' + script.fileName);
					connection.console.log(`    size: ${script.snapshot?.getLength()}`);
				}
				connection.console.log('files:');
				for (const script of project.scripts.values()) {
					connection.console.log('  - ' + script.fileName);
					connection.console.log(`    size: ${script.snapshot?.getLength()}`);
					connection.console.log(`    ref counts: "${(workspace.documentRegistry as any).getLanguageServiceRefCounts?.(script.fileName, project.languageServiceHost.getScriptKind?.(script.fileName))})"`);
				}
			}
			connection.console.log('');
		}
	});
	connection.onRequest(GetMatchTsConfigRequest.type, async params => {
		const project = (await projects.getProject(params.uri));
		if (project?.tsconfig) {
			return { uri: shared.getUriByPath(project.tsconfig) };
		}
	});
	connection.onRequest(GetVirtualFileNamesRequest.type, async document => {
		const project = await projects.getProject(document.uri);
		const fileNames: string[] = [];
		if (project) {
			const sourceFile = project.project?.getLanguageService().context.core.mapper.get(shared.getPathOfUri(document.uri))?.[0];
			if (sourceFile) {
				forEachEmbeddeds(sourceFile.embeddeds, e => {
					if (e.text && e.kind === 1) {
						fileNames.push(e.fileName);
					}
				});
			}
		}
		return fileNames;
	});
	connection.onRequest(GetVirtualFileRequest.type, async params => {
		const project = await projects.getProject(params.sourceFileUri);
		if (project) {
			const embeddedFile = project.project?.getLanguageService().context.core.mapper.fromEmbeddedFileName(params.virtualFileName)?.embedded;
			if (embeddedFile) {
				return {
					content: embeddedFile.text,
					mappings: embeddedFile.mappings as any,
				};
			}
		}
	});
	connection.onNotification(ReloadProjectNotification.type, () => {
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
					progress.report(i++ / allVueDocuments.length * 100, path.relative(ls.context.host.getCurrentDirectory() as path.PosixPath, shared.getPathOfUri(vueFile.uri)));
					if (progress.token.isCancellationRequested) {
						continue;
					}
					let _result = await ls.doValidation(vueFile.uri, progress.token);
					connection.sendDiagnostics({ uri: vueFile.uri, diagnostics: _result });
					errors += _result.filter(error => error.severity === vscode.DiagnosticSeverity.Error).length;
					warnings += _result.filter(error => error.severity === vscode.DiagnosticSeverity.Warning).length;
				}
			}
		}

		progress.done();

		connection.window.showInformationMessage(`Verification complete. Found ${errors} errors and ${warnings} warnings.`);
	});
}
