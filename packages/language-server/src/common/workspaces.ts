import { ConfigurationHost } from '@volar/language-service';
import * as shared from '@volar/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as vscode from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { DiagnosticModel, FileSystemHost, LanguageServerInitializationOptions, LanguageServerPlugin } from '../types';
import { CancellationTokenHost } from './cancellationPipe';
import { createDocuments } from './documents';
import { ServerParams } from './server';
import { createWorkspace, rootTsConfigNames, sortTsConfigs } from './workspace';

export interface WorkspacesParams {
	server: ServerParams;
	initParams: vscode.InitializeParams,
	initOptions: LanguageServerInitializationOptions,
	plugins: ReturnType<LanguageServerPlugin>[],
	ts: typeof import('typescript/lib/tsserverlibrary'),
	tsLocalized: ts.MapLike<string> | undefined,
	fileSystemHost: FileSystemHost,
	configurationHost: ConfigurationHost | undefined,
	documents: ReturnType<typeof createDocuments>,
	cancelTokenHost: CancellationTokenHost,
}

export interface Workspaces extends ReturnType<typeof createWorkspaces> { }

export function createWorkspaces(params: WorkspacesParams) {

	const { fileSystemHost, configurationHost, initParams, initOptions, documents, cancelTokenHost } = params;
	const { connection, runtimeEnv } = params.server;

	let semanticTokensReq = 0;
	let documentUpdatedReq = 0;

	const workspaces = new Map<string, ReturnType<typeof createWorkspace>>();

	documents.onDidChangeContent(params => {
		updateDiagnostics(params.textDocument.uri);
	});
	documents.onDidClose(params => {
		connection.sendDiagnostics({ uri: params.textDocument.uri, diagnostics: [] });
	});
	fileSystemHost.onDidChangeWatchedFiles(params => {
		const tsConfigChanges = params.changes.filter(change => rootTsConfigNames.includes(change.uri.substring(change.uri.lastIndexOf('/') + 1)));
		if (tsConfigChanges.length) {
			reloadDiagnostics();
		}
		else {
			onDriveFileUpdated();
		}
	});
	runtimeEnv.onDidChangeConfiguration?.(async () => {
		onDriveFileUpdated();
	});

	return {
		workspaces,
		getProject,
		reloadProject,
		add: (rootUri: URI) => {
			if (!workspaces.has(rootUri.toString())) {
				workspaces.set(rootUri.toString(), createWorkspace({
					workspaces: params,
					rootUri,
				}));
			}
		},
		remove: (rootUri: URI) => {
			const _workspace = workspaces.get(rootUri.toString());
			workspaces.delete(rootUri.toString());
			(async () => {
				(await _workspace)?.dispose();
			})();
		},
	};

	async function reloadProject() {

		fileSystemHost.reload();

		for (const [_, workspace] of workspaces) {
			(await workspace).reload();
		}

		reloadDiagnostics();
	}

	function reloadDiagnostics() {
		for (const doc of documents.data.values()) {
			connection.sendDiagnostics({ uri: doc.uri, diagnostics: [] });
		}

		onDriveFileUpdated();
	}

	async function onDriveFileUpdated() {

		const req = ++semanticTokensReq;

		await updateDiagnostics();

		if (req === semanticTokensReq) {
			if (initParams.capabilities.textDocument?.semanticTokens) {
				connection.languages.semanticTokens.refresh();
			}
			if (initParams.capabilities.textDocument?.inlayHint) {
				connection.languages.inlayHint.refresh();
			}
		}
	}
	async function updateDiagnostics(docUri?: string) {

		if ((initOptions.diagnosticModel ?? DiagnosticModel.Push) !== DiagnosticModel.Push)
			return;

		const req = ++documentUpdatedReq;
		const delay = await configurationHost?.getConfiguration<number>('volar.diagnostics.delay') ?? 200;
		const cancel = cancelTokenHost.createCancellationToken({
			get isCancellationRequested() {
				return req !== documentUpdatedReq;
			},
			onCancellationRequested: vscode.Event.None,
		});
		const changeDoc = docUri ? documents.data.uriGet(docUri) : undefined;
		const otherDocs = [...documents.data.values()].filter(doc => doc !== changeDoc);

		if (changeDoc) {

			await shared.sleep(delay);

			await sendDocumentDiagnostics(changeDoc.uri, changeDoc.version, cancel);
		}

		for (const doc of otherDocs) {

			await shared.sleep(delay);

			await sendDocumentDiagnostics(doc.uri, doc.version, cancel);

			if (cancel.isCancellationRequested) {
				break;
			}
		}

		async function sendDocumentDiagnostics(uri: string, version: number, cancel: vscode.CancellationToken) {

			if (cancel.isCancellationRequested)
				return;

			const project = (await getProject(uri))?.project;
			if (!project) return;

			const languageService = project.getLanguageService();
			const errors = await languageService.doValidation(uri, cancel, result => {
				connection.sendDiagnostics({ uri: uri, diagnostics: result.map(addVersion), version });
			});

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

		const rootUris = [...workspaces.keys()]
			.filter(rootUri => shared.isFileInDir(shared.getPathOfUri(uri), shared.getPathOfUri(rootUri)))
			.sort((a, b) => sortTsConfigs(shared.getPathOfUri(uri), shared.getPathOfUri(a), shared.getPathOfUri(b)));

		for (const rootUri of rootUris) {
			const workspace = await workspaces.get(rootUri);
			const project = await workspace?.getProjectAndTsConfig(uri);
			if (project) {
				return project;
			}
		}

		if (rootUris.length) {
			const project = await (await workspaces.get(rootUris[0]))?.getInferredProject();
			project?.tryAddFile(shared.getPathOfUri(uri));
			return {
				tsconfig: undefined,
				project,
			};
		}
	}
}
