import * as shared from '@volar/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as path from 'upath';
import * as vscode from 'vscode-languageserver';
import type { createConfigurationHost } from './configurationHost';
import { LanguageConfigs, RuntimeEnvironment } from '../types';
import { createSnapshots } from './snapshots';
import { createWorkspaceProjects, sortPaths } from './workspaceProjects';

export interface Workspaces extends ReturnType<typeof createWorkspaces> { }

const rootTsConfigNames = ['tsconfig.json', 'jsconfig.json'];

export function createWorkspaces(
	runtimeEnv: RuntimeEnvironment,
	languageConfigs: LanguageConfigs,
	ts: typeof import('typescript/lib/tsserverlibrary'),
	tsLocalized: ts.MapLike<string> | undefined,
	options: shared.ServerInitializationOptions,
	documents: ReturnType<typeof createSnapshots>,
	connection: vscode.Connection,
	configurationHost: ReturnType<typeof createConfigurationHost> | undefined,
	capabilities: vscode.ClientCapabilities,
) {

	let semanticTokensReq = 0;
	let documentUpdatedReq = 0;
	let lastOpenDoc: {
		uri: string,
		time: number,
	} | undefined;

	const workspaces = new Map<string, ReturnType<typeof createWorkspaceProjects>>();

	documents.onDidOpen(params => {
		lastOpenDoc = {
			uri: params.textDocument.uri,
			time: Date.now(),
		};
		onDidChangeContent(params.textDocument.uri);
	});
	documents.onDidChangeContent(async params => {
		onDidChangeContent(params.textDocument.uri);
	});
	documents.onDidClose(params => {
		connection.sendDiagnostics({ uri: params.textDocument.uri, diagnostics: [] });
	});
	connection.onDidChangeWatchedFiles(onDidChangeWatchedFiles);

	return {
		workspaces,
		getProject,
		reloadProject,
		add: (rootPath: string) => {
			workspaces.set(rootPath, createWorkspaceProjects(
				runtimeEnv,
				languageConfigs,
				rootPath,
				ts,
				tsLocalized,
				options,
				documents,
				connection,
				configurationHost,
				capabilities,
			));
		},
		remove: (rootPath: string) => {
			workspaces.delete(rootPath);
		},
	};

	async function onDidChangeContent(uri: string) {

		const req = ++documentUpdatedReq;

		await waitForOnDidChangeWatchedFiles(uri);

		for (const workspace of workspaces.values()) {
			const projects = [...workspace.projects.values(), workspace.getInferredProjectDontCreate()].filter(shared.notEmpty);
			for (const project of projects) {
				(await project).onDocumentUpdated();
			}
		}

		if (req === documentUpdatedReq) {
			updateDiagnostics(uri);
		}
	}

	async function reloadProject(uri: string) {

		for (const [_, workspace] of workspaces) {
			workspace.clearFsCache();
		}

		const configs: string[] = [];

		for (const [_, workspace] of workspaces) {
			const config = await workspace.findMatchConfigs(uri);
			if (config) {
				configs.push(config);
			}
		}

		onDidChangeWatchedFiles({ changes: configs.map(c => ({ uri: c, type: vscode.FileChangeType.Changed })) });
	}

	async function onDidChangeWatchedFiles(handler: vscode.DidChangeWatchedFilesParams) {

		if (handler.changes.some(change => change.type === vscode.FileChangeType.Created || change.type === vscode.FileChangeType.Deleted)) {
			for (const [_, workspace] of workspaces) {
				workspace.clearFsCache();
			}
		}

		const tsConfigChanges: vscode.FileEvent[] = [];
		const scriptChanges: vscode.FileEvent[] = [];

		for (const workspace of workspaces.values()) {

			for (const change of handler.changes) {
				const fileName = shared.uriToFsPath(change.uri);
				if (rootTsConfigNames.includes(path.basename(fileName)) || workspace.projects.fsPathHas(fileName)) {
					tsConfigChanges.push(change);
				}
				else {
					scriptChanges.push(change);
				}
			}

			if (tsConfigChanges.length) {

				clearDiagnostics();

				for (const tsConfigChange of tsConfigChanges) {
					const tsConfig = shared.uriToFsPath(tsConfigChange.uri);
					if (workspace.projects.fsPathHas(tsConfig)) {
						workspace.projects.fsPathDelete(tsConfig);
						(async () => (await workspace.projects.fsPathGet(tsConfig))?.dispose())();
					}
					if (tsConfigChange.type !== vscode.FileChangeType.Deleted) {
						workspace.getProjectByCreate(tsConfig); // create new project
					}
				}
			}

			if (scriptChanges.length) {
				const projects = [...workspace.projects.values(), workspace.getInferredProjectDontCreate()].filter(shared.notEmpty);
				for (const project of projects) {
					await (await project).onWorkspaceFilesChanged(scriptChanges);
				}
			}

			onDriveFileUpdated(undefined);
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

		await waitForOnDidChangeWatchedFiles(uri);

		const fileName = shared.uriToFsPath(uri);
		const rootPaths = [...workspaces.keys()]
			.filter(rootPath => shared.isFileInDir(fileName, rootPath))
			.sort((a, b) => sortPaths(a, b, fileName));

		for (const rootPath of rootPaths) {
			const workspace = workspaces.get(rootPath);
			const project = await workspace?.getProjectAndTsConfig(uri);
			if (project) {
				return project;
			}
		}

		if (rootPaths.length) {
			return {
				tsconfig: undefined,
				project: await workspaces.get(rootPaths[0])?.getInferredProject(),
			};
		}
	}
	async function waitForOnDidChangeWatchedFiles(uri: string) {
		if (lastOpenDoc?.uri === uri) {
			const dt = lastOpenDoc.time + 2000 - Date.now();
			if (dt > 0) {
				await shared.sleep(dt);
			}
		}
	}
	function clearDiagnostics() {
		for (const doc of documents.data.values()) {
			connection.sendDiagnostics({ uri: doc.uri, diagnostics: [] });
		}
	}
}
