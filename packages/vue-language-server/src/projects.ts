import * as shared from '@volar/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as path from 'upath';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver';
import { createProject, Project } from './project';
import type { createLsConfigs } from './configHost';
import { getDocumentSafely } from './utils';
import { LanguageConfigs, RuntimeEnvironment } from './common';

export interface Projects extends ReturnType<typeof createProjects> { }

const rootTsConfigNames = ['tsconfig.json', 'jsconfig.json'];

export function createProjects(
	runtimeEnv: RuntimeEnvironment,
	languageConfigs: LanguageConfigs,
	rootPaths: string[],
	ts: typeof import('typescript/lib/tsserverlibrary'),
	tsLocalized: ts.MapLike<string> | undefined,
	options: shared.ServerInitializationOptions,
	documents: vscode.TextDocuments<TextDocument>,
	connection: vscode.Connection,
	lsConfigs: ReturnType<typeof createLsConfigs> | undefined,
	getInferredCompilerOptions: () => Promise<ts.CompilerOptions>,
	capabilities: vscode.ClientCapabilities,
) {

	let semanticTokensReq = 0;
	let documentUpdatedReq = 0;
	let lastOpenDoc: {
		uri: string,
		time: number,
	} | undefined;
	const fileExistsCache = shared.createPathMap<boolean>();
	const directoryExistsCache = shared.createPathMap<boolean>();
	const sys: ts.System = capabilities.workspace?.didChangeWatchedFiles // don't cache fs result if client not supports file watcher
		? {
			...ts.sys,
			fileExists(path: string) {
				if (!fileExistsCache.fsPathHas(path)) {
					fileExistsCache.fsPathSet(path, ts.sys.fileExists(path));
				}
				return fileExistsCache.fsPathGet(path)!;
			},
			directoryExists(path: string) {
				if (!directoryExistsCache.fsPathHas(path)) {
					directoryExistsCache.fsPathSet(path, ts.sys.directoryExists(path));
				}
				return directoryExistsCache.fsPathGet(path)!;
			},
		}
		: ts.sys;

	const workspaces = new Map<string, ReturnType<typeof createWorkspace>>();

	for (const rootPath of rootPaths) {
		workspaces.set(rootPath, createWorkspace(
			runtimeEnv,
			languageConfigs,
			rootPath,
			ts,
			sys,
			tsLocalized,
			options,
			documents,
			connection,
			lsConfigs,
			getInferredCompilerOptions,
		));
	}

	documents.onDidOpen(async change => {
		lastOpenDoc = {
			uri: change.document.uri,
			time: Date.now(),
		};
	});
	documents.onDidChangeContent(async change => {

		const req = ++documentUpdatedReq;

		await waitForOnDidChangeWatchedFiles(change.document.uri);

		for (const workspace of workspaces.values()) {
			const projects = [...workspace.projects.values(), workspace.getInferredProjectDontCreate()].filter(shared.notEmpty);
			for (const project of projects) {
				(await project).onDocumentUpdated(change.document);
			}
		}

		if (req === documentUpdatedReq) {
			updateDiagnostics(change.document.uri);
		}
	});
	documents.onDidClose(change => {
		connection.sendDiagnostics({ uri: change.document.uri, diagnostics: [] });
	});
	connection.onDidChangeWatchedFiles(onDidChangeWatchedFiles);

	return {
		workspaces,
		getProject,
		reloadProject,
	};

	async function reloadProject(uri: string) {

		fileExistsCache.clear();
		directoryExistsCache.clear();

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

		for (const change of handler.changes) {
			if (change.type === vscode.FileChangeType.Created) {
				fileExistsCache.uriSet(change.uri, true);
			}
			else if (change.type === vscode.FileChangeType.Deleted) {
				fileExistsCache.uriSet(change.uri, false);
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
		const delay = await lsConfigs?.getConfiguration<number>('volar.diagnostics.delay');

		let lastCheckCancelAt = 0;
		let _isCancel = false;
		const isCancel = async () => {
			if (Date.now() - lastCheckCancelAt >= 5) {
				await shared.sleep(5); // wait for onDidChangeContent polling
				_isCancel = req !== documentUpdatedReq;
				lastCheckCancelAt = Date.now();
			}
			return _isCancel;
		};

		const changeDocs = docUri ? [getDocumentSafely(documents, docUri)].filter(shared.notEmpty) : [];
		const otherDocs = documents.all().filter(doc => doc.uri !== docUri);

		for (const changeDoc of changeDocs) {

			await shared.sleep(delay ?? 200);

			if (await isCancel())
				return;

			await sendDocumentDiagnostics(changeDoc.uri, isCancel);
		}

		for (const doc of otherDocs) {

			await shared.sleep(delay ?? 200);

			if (await isCancel())
				return;

			await sendDocumentDiagnostics(doc.uri, isCancel);
		}

		async function sendDocumentDiagnostics(uri: string, isCancel?: () => Promise<boolean>) {

			const project = (await getProject(uri))?.project;
			if (!project) return;

			const languageService = project.getLanguageService();
			const errors = await languageService.doValidation(uri, async result => {
				connection.sendDiagnostics({ uri: uri, diagnostics: result });
			}, isCancel);

			if (!await isCancel?.()) {
				connection.sendDiagnostics({ uri: uri, diagnostics: errors });
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
		for (const doc of documents.all()) {
			connection.sendDiagnostics({ uri: doc.uri, diagnostics: [] });
		}
	}
}

function createWorkspace(
	runtimeEnv: RuntimeEnvironment,
	languageConfigs: LanguageConfigs,
	rootPath: string,
	ts: typeof import('typescript/lib/tsserverlibrary'),
	sys: ts.System,
	tsLocalized: ts.MapLike<string> | undefined,
	options: shared.ServerInitializationOptions,
	documents: vscode.TextDocuments<TextDocument>,
	connection: vscode.Connection,
	lsConfigs: ReturnType<typeof createLsConfigs> | undefined,
	getInferredCompilerOptions: () => Promise<ts.CompilerOptions>,
) {

	const rootTsConfigs = sys.readDirectory(rootPath, rootTsConfigNames, undefined, ['**/*']);
	const projects = shared.createPathMap<Project>();
	let inferredProject: Project | undefined;

	const getRootPath = () => rootPath;
	const workspaceSys = sys.getCurrentDirectory() === rootPath ? sys : new Proxy(sys, {
		get(target, prop) {
			const fn = target[prop as keyof typeof target];
			if (typeof fn === 'function') {
				return new Proxy(fn, {
					apply(target, thisArg, args) {
						const cwd = process.cwd;
						process.cwd = getRootPath;
						const result = (target as any).apply(thisArg, args);
						process.cwd = cwd;
						return result;
					}
				});
			}
			return fn;
		},
	});

	return {
		projects,
		findMatchConfigs,
		getProjectAndTsConfig,
		getProjectByCreate,
		getInferredProject,
		getInferredProjectDontCreate: () => inferredProject,
	};

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
	async function getInferredProject() {
		if (!inferredProject) {
			inferredProject = createProject(
				runtimeEnv,
				languageConfigs,
				ts,
				workspaceSys,
				options,
				rootPath,
				await getInferredCompilerOptions(),
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

			matches = matches.sort((a, b) => sortPaths(fileName, a, b));

			if (matches.length) {
				getParsedCommandLine(matches[0]);
			}
		}
		function findDirectIncludeTsconfig() {
			return findTsconfig(async tsconfig => {
				const parsedCommandLine = await getParsedCommandLine(tsconfig);
				// use toLowerCase to fix https://github.com/johnsoncodehk/volar/issues/1125
				const fileNames = new Set(parsedCommandLine.fileNames.map(fileName => fileName.toLowerCase()));
				return fileNames.has(fileName.toLowerCase());
			});
		}
		function findIndirectReferenceTsconfig() {
			return findTsconfig(async tsconfig => {
				const project = await projects.fsPathGet(tsconfig);
				const ls = await project?.getLanguageServiceDontCreate();
				const validDoc = ls?.__internal__.context.getTsLs().__internal__.getValidTextDocument(uri);
				return !!validDoc;
			});
		}
		async function findTsconfig(match: (tsconfig: string) => Promise<boolean> | boolean) {

			const checked = new Set<string>();

			for (const rootTsConfig of rootTsConfigs.sort((a, b) => sortPaths(fileName, a, b))) {
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
					if (!sys.fileExists(tsConfigPath) && sys.directoryExists(tsConfigPath)) {
						const newTsConfigPath = path.join(tsConfigPath, 'tsconfig.json');
						const newJsConfigPath = path.join(tsConfigPath, 'jsconfig.json');
						if (sys.fileExists(newTsConfigPath)) {
							tsConfigPath = newTsConfigPath;
						}
						else if (sys.fileExists(newJsConfigPath)) {
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
				languageConfigs,
				ts,
				workspaceSys,
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

function sortPaths(fileName: string, a: string, b: string) {

	const inA = shared.isFileInDir(fileName, path.dirname(a));
	const inB = shared.isFileInDir(fileName, path.dirname(b));

	if (inA !== inB) {
		const aWeight = inA ? 1 : 0;
		const bWeight = inB ? 1 : 0;
		return bWeight - aWeight;
	}

	const aLength = a.split('/').length;
	const bLength = b.split('/').length;

	if (aLength === bLength) {
		const aWeight = path.basename(a) === 'tsconfig.json' ? 1 : 0;
		const bWeight = path.basename(b) === 'tsconfig.json' ? 1 : 0;
		return bWeight - aWeight;
	}

	return bLength - aLength;
}
