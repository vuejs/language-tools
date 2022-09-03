import * as shared from '@volar/shared';
import { ConfigurationHost } from '@volar/vue-language-service';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as vscode from 'vscode-languageserver';
import { FileSystemHost, LanguageConfigs, RuntimeEnvironment, ServerInitializationOptions } from '../types';
import { createSnapshots } from './snapshots';
import { createWorkspaceProjects, rootTsConfigNames, sortPaths } from './workspaceProjects';

export interface Workspaces extends ReturnType<typeof createWorkspaces> { }

export function createWorkspaces(
	runtimeEnv: RuntimeEnvironment,
	languageConfigs: LanguageConfigs,
	fsHost: FileSystemHost,
	configurationHost: ConfigurationHost | undefined,
	ts: typeof import('typescript/lib/tsserverlibrary'),
	tsLocalized: ts.MapLike<string> | undefined,
	options: ServerInitializationOptions,
	documents: ReturnType<typeof createSnapshots>,
	connection: vscode.Connection,
) {

	let semanticTokensReq = 0;
	let documentUpdatedReq = 0;

	const workspaces = new Map<string, ReturnType<typeof createWorkspaceProjects>>();

	documents.onDidOpen(params => {
		updateDiagnostics(params.textDocument.uri);
	});
	documents.onDidChangeContent(async params => {
		updateDiagnostics(params.textDocument.uri);
	});
	documents.onDidClose(params => {
		connection.sendDiagnostics({ uri: params.textDocument.uri, diagnostics: [] });
	});
	fsHost.onDidChangeWatchedFiles(params => {

		const tsConfigChanges = params.changes.filter(change => rootTsConfigNames.includes(change.uri.substring(change.uri.lastIndexOf('/') + 1)));
		if (tsConfigChanges.length) {
			for (const doc of documents.data.values()) {
				connection.sendDiagnostics({ uri: doc.uri, diagnostics: [] });
			}
		}

		onDriveFileUpdated(undefined);
	});
	runtimeEnv.onDidChangeConfiguration?.(async () => {
		onDriveFileUpdated(undefined);
	});

	return {
		workspaces,
		getProject,
		reloadProject,
		add: (rootPath: string) => {
			workspaces.set(rootPath, createWorkspaceProjects(
				runtimeEnv,
				languageConfigs,
				fsHost,
				rootPath,
				ts,
				tsLocalized,
				options,
				documents,
				connection,
				configurationHost,
			));
		},
		remove: (rootPath: string) => {
			const _workspace = workspaces.get(rootPath);
			workspaces.delete(rootPath);
			(async () => {
				(await _workspace)?.dispose();
			})();
		},
	};

	async function reloadProject() {

		fsHost.clearCache();

		for (const [_, workspace] of workspaces) {
			(await workspace).reload();
		}
	}

	async function onDriveFileUpdated(driveFileName: string | undefined) {

		const req = ++semanticTokensReq;

		await updateDiagnostics(driveFileName ? shared.fsPathToUri(driveFileName) : undefined);

		if (req === semanticTokensReq) {
			if (options.languageFeatures?.semanticTokens) {
				connection.languages.semanticTokens.refresh();
			}
			if (options.languageFeatures?.inlayHints) {
				connection.languages.semanticTokens.refresh();
			}
		}
	}
	async function updateDiagnostics(docUri?: string) {

		if (!options.languageFeatures?.diagnostics)
			return;

		const req = ++documentUpdatedReq;
		const delay = await configurationHost?.getConfiguration<number>('volar.diagnostics.delay');
		const cancel: vscode.CancellationToken = {
			get isCancellationRequested() {
				return req !== documentUpdatedReq;
			},
			// @ts-ignore
			onCancellationRequested: undefined,
		};

		const changeDoc = docUri ? documents.data.uriGet(docUri) : undefined;
		const otherDocs = [...documents.data.values()].filter(doc => doc !== changeDoc);

		if (changeDoc) {

			await shared.sleep(delay ?? 200);

			await sendDocumentDiagnostics(changeDoc.uri, changeDoc.version, cancel);
		}

		for (const doc of otherDocs) {

			await shared.sleep(delay ?? 200);

			await sendDocumentDiagnostics(doc.uri, doc.version, cancel);

			if (cancel.isCancellationRequested) {
				break;
			}
		}

		async function sendDocumentDiagnostics(uri: string, version: number, cancel?: vscode.CancellationToken) {

			const project = (await getProject(uri))?.project;
			if (!project) return;

			const languageService = project.getLanguageService();
			const errors = await languageService.doValidation(uri, result => {
				connection.sendDiagnostics({ uri: uri, diagnostics: result.map(addVersion), version });
			}, cancel);

			connection.sendDiagnostics({ uri: uri, diagnostics: errors.map(addVersion), version });

			function addVersion(error: vscode.Diagnostic) {
				if (error.data === undefined) {
					error.data = { version };
				}
				else if (typeof error.data === 'object') {
					error.data.version = version;
				}
				return error;
			}
		}
	}
	async function getProject(uri: string) {

		const fileName = shared.uriToFsPath(uri);
		const rootPaths = [...workspaces.keys()]
			.filter(rootPath => shared.isFileInDir(fileName, rootPath))
			.sort((a, b) => sortPaths(a, b, fileName));

		for (const rootPath of rootPaths) {
			const workspace = await workspaces.get(rootPath);
			const project = await workspace?.getProjectAndTsConfig(uri);
			if (project) {
				return project;
			}
		}

		if (rootPaths.length) {
			return {
				tsconfig: undefined,
				project: await (await workspaces.get(rootPaths[0]))?.getInferredProject(),
			};
		}
	}
}
