import * as shared from '@volar/shared';
import { ConfigurationHost } from '@volar/vue-language-service';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as vscode from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { DiagnosticModel, FileSystemHost, LanguageServerPlugin, RuntimeEnvironment, ServerInitializationOptions } from '../types';
import { createSnapshots } from './snapshots';
import { createWorkspaceProjects, rootTsConfigNames, sortTsConfigs } from './workspaceProjects';

export interface Workspaces extends ReturnType<typeof createWorkspaces> { }

export function createWorkspaces(
	runtimeEnv: RuntimeEnvironment,
	plugins: ReturnType<LanguageServerPlugin>[],
	fsHost: FileSystemHost,
	configurationHost: ConfigurationHost | undefined,
	ts: typeof import('typescript/lib/tsserverlibrary'),
	tsLocalized: ts.MapLike<string> | undefined,
	client: vscode.ClientCapabilities,
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

		onDriveFileUpdated();
	});
	runtimeEnv.onDidChangeConfiguration?.(async () => {
		onDriveFileUpdated();
	});

	return {
		workspaces,
		getProject,
		reloadProject,
		add: (rootUri: URI) => {
			workspaces.set(rootUri.toString(), createWorkspaceProjects(
				runtimeEnv,
				plugins,
				fsHost,
				rootUri,
				ts,
				tsLocalized,
				options,
				documents,
				connection,
				configurationHost,
			));
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

		fsHost.clearCache();

		for (const [_, workspace] of workspaces) {
			(await workspace).reload();
		}
	}

	async function onDriveFileUpdated() {

		const req = ++semanticTokensReq;

		await updateDiagnostics();

		if (req === semanticTokensReq) {
			if (client.textDocument?.semanticTokens) {
				connection.languages.semanticTokens.refresh();
			}
			if (client.textDocument?.inlayHint) {
				connection.languages.inlayHint.refresh();
			}
		}
	}
	async function updateDiagnostics(docUri?: string) {

		if ((options.diagnosticModel ?? DiagnosticModel.Push) !== DiagnosticModel.Push)
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

		const rootUris = [...workspaces.keys()]
			.filter(rootUri => shared.isFileInDir(URI.parse(uri).fsPath, URI.parse(rootUri).fsPath))
			.sort((a, b) => sortTsConfigs(URI.parse(uri).fsPath, URI.parse(a).fsPath, URI.parse(b).fsPath));

		for (const rootUri of rootUris) {
			const workspace = await workspaces.get(rootUri);
			const project = await workspace?.getProjectAndTsConfig(uri);
			if (project) {
				return project;
			}
		}

		if (rootUris.length) {
			return {
				tsconfig: undefined,
				project: await (await workspaces.get(rootUris[0]))?.getInferredProject(),
			};
		}
	}
}
