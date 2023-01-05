import { ConfigurationHost } from '@volar/language-service';
import * as shared from '@volar/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as vscode from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { DiagnosticModel, FileSystemHost, LanguageServerInitializationOptions, LanguageServerPlugin, ServerMode } from '../types';
import { CancellationTokenHost } from './cancellationPipe';
import { createDocuments } from './documents';
import { ServerContext } from './server';
import { createWorkspace, rootTsConfigNames, sortTsConfigs } from './workspace';

export interface WorkspacesContext {
	server: ServerContext;
	initParams: vscode.InitializeParams,
	initOptions: LanguageServerInitializationOptions,
	plugins: ReturnType<LanguageServerPlugin>[],
	ts: typeof import('typescript/lib/tsserverlibrary') | undefined,
	tsLocalized: ts.MapLike<string> | undefined,
	fileSystemHost: FileSystemHost | undefined,
	configurationHost: ConfigurationHost | undefined,
	documents: ReturnType<typeof createDocuments>,
	cancelTokenHost: CancellationTokenHost,
}

export interface Workspaces extends ReturnType<typeof createWorkspaces> { }

export function createWorkspaces(context: WorkspacesContext) {

	const workspaces = new Map<string, ReturnType<typeof createWorkspace>>();

	let semanticTokensReq = 0;
	let documentUpdatedReq = 0;

	context.documents.onDidChangeContent(({ textDocument }) => {
		updateDiagnostics(textDocument.uri);
	});
	context.documents.onDidClose(({ textDocument }) => {
		context.server.connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: [] });
	});
	context.fileSystemHost?.onDidChangeWatchedFiles(({ changes }) => {
		const tsConfigChanges = changes.filter(change => rootTsConfigNames.includes(change.uri.substring(change.uri.lastIndexOf('/') + 1)));
		if (tsConfigChanges.length) {
			reloadDiagnostics();
		}
		else {
			updateDiagnosticsAndSemanticTokens();
		}
	});
	context.server.runtimeEnv.onDidChangeConfiguration?.(async () => {
		updateDiagnosticsAndSemanticTokens();
	});

	return {
		workspaces,
		getProject: getProjectAndTsConfig,
		reloadProject,
		add: (rootUri: URI) => {
			if (!workspaces.has(rootUri.toString())) {
				workspaces.set(rootUri.toString(), createWorkspace({
					workspaces: context,
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

		context.fileSystemHost?.reload();

		for (const [_, workspace] of workspaces) {
			(await workspace).reload();
		}

		reloadDiagnostics();
	}

	function reloadDiagnostics() {
		for (const doc of context.documents.data.values()) {
			context.server.connection.sendDiagnostics({ uri: doc.uri, diagnostics: [] });
		}

		updateDiagnosticsAndSemanticTokens();
	}

	async function updateDiagnosticsAndSemanticTokens() {

		const req = ++semanticTokensReq;

		await updateDiagnostics();

		const delay = await context.configurationHost?.getConfiguration<number>('volar.diagnostics.delay') ?? 200;
		await shared.sleep(delay);

		if (req === semanticTokensReq) {
			if (context.initParams.capabilities.textDocument?.semanticTokens) {
				context.server.connection.languages.semanticTokens.refresh();
			}
			if (context.initParams.capabilities.textDocument?.inlayHint) {
				context.server.connection.languages.inlayHint.refresh();
			}
		}
	}

	async function updateDiagnostics(docUri?: string) {

		if ((context.initOptions.diagnosticModel ?? DiagnosticModel.Push) !== DiagnosticModel.Push)
			return;

		const req = ++documentUpdatedReq;
		const delay = await context.configurationHost?.getConfiguration<number>('volar.diagnostics.delay') ?? 200;
		const cancel = context.cancelTokenHost.createCancellationToken({
			get isCancellationRequested() {
				return req !== documentUpdatedReq;
			},
			onCancellationRequested: vscode.Event.None,
		});
		const changeDoc = docUri ? context.documents.data.uriGet(docUri) : undefined;
		const otherDocs = [...context.documents.data.values()].filter(doc => doc !== changeDoc);

		if (changeDoc) {
			await shared.sleep(delay);
			if (cancel.isCancellationRequested) {
				return;
			}
			await sendDocumentDiagnostics(changeDoc.uri, changeDoc.version, cancel);
		}

		for (const doc of otherDocs) {
			await shared.sleep(delay);
			if (cancel.isCancellationRequested) {
				break;
			}
			await sendDocumentDiagnostics(doc.uri, doc.version, cancel);
		}
	}

	async function sendDocumentDiagnostics(uri: string, version: number, cancel: vscode.CancellationToken) {

		const project = (await getProjectAndTsConfig(uri))?.project;
		if (!project) return;

		const languageService = project.getLanguageService();
		const errors = await languageService.doValidation(uri, cancel, result => {
			context.server.connection.sendDiagnostics({ uri: uri, diagnostics: result.map(addVersion), version });
		});

		context.server.connection.sendDiagnostics({ uri: uri, diagnostics: errors.map(addVersion), version });

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

	async function getProjectAndTsConfig(uri: string) {

		const rootUris = [...workspaces.keys()]
			.filter(rootUri => shared.isFileInDir(shared.getPathOfUri(uri), shared.getPathOfUri(rootUri)))
			.sort((a, b) => sortTsConfigs(shared.getPathOfUri(uri), shared.getPathOfUri(a), shared.getPathOfUri(b)));

		if (context.initOptions.serverMode !== ServerMode.Syntactic) {
			for (const rootUri of rootUris) {
				const workspace = await workspaces.get(rootUri);
				const projectAndTsConfig = await workspace?.getProjectAndTsConfig(uri);
				if (projectAndTsConfig) {
					return projectAndTsConfig;
				}
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
