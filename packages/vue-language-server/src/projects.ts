import * as shared from '@volar/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as path from 'upath';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver';
import { createProject, Project } from './project';
import type { createLsConfigs } from './configs';
import { getDocumentSafely } from './utils';
import { RuntimeEnvironment } from './common';

export interface Projects extends ReturnType<typeof createProjects> { }

const rootTsConfigNames = ['tsconfig.json', 'jsconfig.json'];

export function createProjects(
	runtimeEnv: RuntimeEnvironment,
	rootPaths: string[],
	ts: typeof import('typescript/lib/tsserverlibrary'),
	tsLocalized: ts.MapLike<string> | undefined,
	options: shared.ServerInitializationOptions,
	documents: vscode.TextDocuments<TextDocument>,
	connection: vscode.Connection,
	lsConfigs: ReturnType<typeof createLsConfigs> | undefined,
	inferredCompilerOptions: ts.CompilerOptions,
) {

	let semanticTokensReq = 0;
	let documentUpdatedReq = 0;
	let lastOpenDoc: {
		uri: string,
		time: number,
	} | undefined;

	const updatedUris = new Set<string>();
	const workspaces = new Map<string, ReturnType<typeof createWorkspace>>();

	for (const rootPath of rootPaths) {
		workspaces.set(rootPath, createWorkspace(
			runtimeEnv,
			rootPath,
			ts,
			tsLocalized,
			options,
			documents,
			connection,
			lsConfigs,
			inferredCompilerOptions,
		));
	}

	documents.onDidOpen(async change => {
		lastOpenDoc = {
			uri: change.document.uri,
			time: Date.now(),
		};
	});
	documents.onDidChangeContent(async change => {

		await waitForOnDidChangeWatchedFiles(change.document.uri);

		for (const workspace of workspaces.values()) {
			const projects = [...workspace.projects.values(), workspace.getInferredProjectDontCreate()].filter(shared.notEmpty);
			for (const project of projects) {
				(await project).onDocumentUpdated(change.document);
			}
		}

		updateDiagnostics(change.document.uri);
	});
	documents.onDidClose(change => {
		connection.sendDiagnostics({ uri: change.document.uri, diagnostics: [] });
	});
	connection.onDidChangeWatchedFiles(async handler => {

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
	});

	updateDiagnostics(undefined);

	return {
		workspaces,
		getProject,
	};

	async function onDriveFileUpdated(driveFileName: string | undefined) {

		const req = ++semanticTokensReq;

		await updateDiagnostics(driveFileName ? shared.fsPathToUri(driveFileName) : undefined);

		await shared.sleep(100);

		if (req === semanticTokensReq) {
			if (options.languageFeatures?.semanticTokens) {
				connection.languages.semanticTokens.refresh();
			}
		}
	}
	async function updateDiagnostics(docUri?: string) {

		if (!options.languageFeatures?.diagnostics)
			return;

		if (docUri) {
			updatedUris.add(docUri);
		}

		const req = ++documentUpdatedReq;

		await shared.sleep(100);

		if (req !== documentUpdatedReq)
			return;

		const changeDocs = [...updatedUris].map(uri => getDocumentSafely(documents, uri)).filter(shared.notEmpty);
		const otherDocs = documents.all().filter(doc => !updatedUris.has(doc.uri));

		for (const changeDoc of changeDocs) {

			if (req !== documentUpdatedReq)
				return;

			let _isCancel = false;
			const isDocCancel = getCancelChecker(changeDoc.uri, changeDoc.version);
			const isCancel = async () => {
				const result = req !== documentUpdatedReq || await isDocCancel();
				_isCancel = result;
				return result;
			};

			await sendDocumentDiagnostics(changeDoc.uri, isCancel);

			if (!_isCancel) {
				updatedUris.delete(changeDoc.uri);
			}
		}

		for (const doc of otherDocs) {

			if (req !== documentUpdatedReq)
				return;

			const changeDoc = docUri ? getDocumentSafely(documents, docUri) : undefined;
			const isDocCancel = changeDoc ? getCancelChecker(changeDoc.uri, changeDoc.version) : async () => {
				await shared.sleep(0);
				return false;
			};
			const isCancel = async () => req !== documentUpdatedReq || await isDocCancel();

			await sendDocumentDiagnostics(doc.uri, isCancel);
		}

		function getCancelChecker(uri: string, version: number) {
			let _isCancel = false;
			let lastResultAt = Date.now();
			return async () => {
				if (_isCancel) {
					return true;
				}
				if (
					typeof options.languageFeatures?.diagnostics === 'object'
					&& options.languageFeatures.diagnostics.getDocumentVersionRequest
					&& Date.now() - lastResultAt >= 1 // 1ms
				) {
					const clientDocVersion = await connection.sendRequest(shared.GetDocumentVersionRequest.type, { uri });
					if (clientDocVersion !== null && clientDocVersion !== undefined && version !== clientDocVersion) {
						_isCancel = true;
					}
					lastResultAt = Date.now();
				}
				return _isCancel;
			};
		}
		async function sendDocumentDiagnostics(uri: string, isCancel?: () => Promise<boolean>) {

			const project = (await getProject(uri))?.project;
			if (!project) return;

			const languageService = await project.getLanguageService();
			const errors = await languageService.doValidation(uri, async result => {
				connection.sendDiagnostics({ uri: uri, diagnostics: result });
			}, isCancel);

			if (errors) {
				connection.sendDiagnostics({ uri: uri, diagnostics: errors });
			}
		}
	}
	async function getProject(uri: string) {

		await waitForOnDidChangeWatchedFiles(uri);

		const fileName = shared.uriToFsPath(uri);
		const rootPaths = [...workspaces.keys()]
			.filter(rootPath => shared.isFileInDir(fileName, rootPath))
			.sort(sortPaths);

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
		for (const doc of documents.all()) {
			connection.sendDiagnostics({ uri: doc.uri, diagnostics: [] });
		}
	}
}

function createWorkspace(
	runtimeEnv: RuntimeEnvironment,
	rootPath: string,
	ts: typeof import('typescript/lib/tsserverlibrary'),
	tsLocalized: ts.MapLike<string> | undefined,
	options: shared.ServerInitializationOptions,
	documents: vscode.TextDocuments<TextDocument>,
	connection: vscode.Connection,
	lsConfigs: ReturnType<typeof createLsConfigs> | undefined,
	inferredCompilerOptions: ts.CompilerOptions,
) {

	const rootTsConfigs = ts.sys.readDirectory(rootPath, rootTsConfigNames, undefined, ['**/*']);
	const projects = shared.createPathMap<Project>();
	let inferredProject: Project | undefined;

	return {
		projects,
		getProject,
		getProjectAndTsConfig,
		getProjectByCreate,
		getInferredProject,
		getInferredProjectDontCreate: () => inferredProject,
	};

	async function getProject(uri: string) {
		return (await getProjectAndTsConfig(uri))?.project;
	}
	async function getProjectAndTsConfig(uri: string) {
		const tsconfig = await findMatchConfigs(uri);
		if (tsconfig) {
			const project = await getProjectByCreate(tsconfig);
			return {
				tsconfig: tsconfig,
				project,
			};
		}
	}
	function getInferredProject() {
		if (!inferredProject) {
			inferredProject = createProject(
				runtimeEnv,
				ts,
				options,
				rootPath,
				inferredCompilerOptions,
				tsLocalized,
				documents,
				connection,
				lsConfigs,
			);
		}
		return inferredProject;
	}
	async function findMatchConfigs(uri: string) {

		const fileName = shared.uriToFsPath(uri);

		prepareClosestootParsedCommandLine();
		return await findDirectIncludeTsconfig() ?? await findIndirectReferenceTsconfig();

		function prepareClosestootParsedCommandLine() {

			let matches: string[] = [];

			for (const rootTsConfig of rootTsConfigs) {
				if (shared.isFileInDir(shared.uriToFsPath(uri), path.dirname(rootTsConfig))) {
					matches.push(rootTsConfig);
				}
			}

			matches = matches.sort(sortPaths);

			if (matches.length) {
				getParsedCommandLine(matches[0]);
			}
		}
		function findDirectIncludeTsconfig() {
			return findTsconfig(async tsconfig => {
				const parsedCommandLine = await getParsedCommandLine(tsconfig);
				const fileNames = new Set(parsedCommandLine.fileNames);
				return fileNames.has(fileName);
			});
		}
		function findIndirectReferenceTsconfig() {
			return findTsconfig(async tsconfig => {
				const project = await projects.fsPathGet(tsconfig);
				const ls = await project?.getLanguageServiceDontCreate();
				const validDoc = ls?.__internal__.context.getTsLs('script').__internal__.getValidTextDocument(uri);
				return !!validDoc;
			});
		}
		async function findTsconfig(match: (tsconfig: string) => Promise<boolean> | boolean) {

			const checked = new Set<string>();

			for (const rootTsConfig of rootTsConfigs.sort(sortPaths)) {
				const project = await projects.fsPathGet(rootTsConfig);
				if (project) {

					const chains = await getReferencesChains(project.getParsedCommandLine(), rootTsConfig, []);

					for (const chain of chains) {
						for (let i = chain.length - 1; i >= 0; i--) {
							const tsconfig = chain[i];

							if (checked.has(tsconfig))
								continue;
							checked.add(tsconfig);

							if (await match(tsconfig)) {
								return tsconfig;
							}
						}
					}
				}
			}
		}
		async function getReferencesChains(parsedCommandLine: ts.ParsedCommandLine, tsConfig: string, before: string[]) {

			if (parsedCommandLine.projectReferences?.length) {

				const newChains: string[][] = [];

				for (const projectReference of parsedCommandLine.projectReferences) {

					let tsConfigPath = projectReference.path;

					// fix https://github.com/johnsoncodehk/volar/issues/712
					if (!ts.sys.fileExists(tsConfigPath) && ts.sys.directoryExists(tsConfigPath)) {
						const newTsConfigPath = path.join(tsConfigPath, 'tsconfig.json');
						const newJsConfigPath = path.join(tsConfigPath, 'jsconfig.json');
						if (ts.sys.fileExists(newTsConfigPath)) {
							tsConfigPath = newTsConfigPath;
						}
						else if (ts.sys.fileExists(newJsConfigPath)) {
							tsConfigPath = newJsConfigPath;
						}
					}

					const beforeIndex = before.indexOf(tsConfigPath); // cycle
					if (beforeIndex >= 0) {
						newChains.push(before.slice(0, Math.max(beforeIndex, 1)));
					}
					else {
						const referenceParsedCommandLine = await getParsedCommandLine(tsConfigPath);
						for (const chain of await getReferencesChains(referenceParsedCommandLine, tsConfigPath, [...before, tsConfig])) {
							newChains.push(chain);
						}
					}
				}

				return newChains;
			}
			else {
				return [[...before, tsConfig]];
			}
		}
		async function getParsedCommandLine(tsConfig: string) {
			const project = await getProjectByCreate(tsConfig);
			return project.getParsedCommandLine();
		}
	}
	function getProjectByCreate(tsConfig: string) {
		let project = projects.fsPathGet(tsConfig);
		if (!project) {
			project = createProject(
				runtimeEnv,
				ts,
				options,
				path.dirname(tsConfig),
				tsConfig,
				tsLocalized,
				documents,
				connection,
				lsConfigs,
			);
			projects.fsPathSet(tsConfig, project);
		}
		return project;
	}
}

function sortPaths(a: string, b: string) {

	const aLength = a.split('/').length;
	const bLength = b.split('/').length;

	if (aLength === bLength) {
		const aWeight = path.basename(a) === 'tsconfig.json' ? 1 : 0;
		const bWeight = path.basename(b) === 'tsconfig.json' ? 1 : 0;
		return bWeight - aWeight;
	}

	return bLength - aLength;
}
