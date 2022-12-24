import * as shared from '@volar/shared';
import * as vscode from 'vscode-languageserver';
import type { Workspaces } from '../workspaces';
import { GetMatchTsConfigRequest, ReloadProjectNotification, WriteVirtualFilesNotification, GetVirtualFileNamesRequest, GetVirtualFileRequest, ReportStats } from '../../protocol';
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
			const sourceFile = project.project?.getLanguageService().context.core.mapper.get(shared.getPathOfUri(document.uri))?.[1];
			if (sourceFile) {
				forEachEmbeddeds(sourceFile, e => {
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
			const virtualFile = project.project?.getLanguageService().context.core.mapper.getSourceByVirtualFileName(params.virtualFileName)?.[2];
			if (virtualFile) {
				return {
					content: virtualFile.text,
					mappings: virtualFile.mappings as any,
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
}
