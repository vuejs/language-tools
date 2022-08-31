import * as shared from '@volar/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as path from 'upath';
import * as vscode from 'vscode-languageserver';
import { createProject, Project } from './project';
import type { createLsConfigs } from './configHost';
import { LanguageConfigs, RuntimeEnvironment } from '../types';
import { createSnapshots } from './snapshots';

const rootTsConfigNames = ['tsconfig.json', 'jsconfig.json'];

let currentCwd = '';

export function createWorkspaceProjects(
	runtimeEnv: RuntimeEnvironment,
	languageConfigs: LanguageConfigs,
	rootPath: string,
	ts: typeof import('typescript/lib/tsserverlibrary'),
	tsLocalized: ts.MapLike<string> | undefined,
	options: shared.ServerInitializationOptions,
	documents: ReturnType<typeof createSnapshots>,
	connection: vscode.Connection,
	lsConfigs: ReturnType<typeof createLsConfigs> | undefined,
	getInferredCompilerOptions: () => Promise<ts.CompilerOptions>,
	capabilities: vscode.ClientCapabilities,
) {

	const rootTsConfigs = ts.sys.readDirectory(rootPath, rootTsConfigNames, undefined, ['**/*']);
	const projects = shared.createPathMap<Project>();
	let inferredProject: Project | undefined;

	const _workspaceSys = new Proxy(ts.sys, {
		get(target, prop) {
			const fn = target[prop as keyof typeof target];
			if (typeof fn === 'function') {
				return new Proxy(fn, {
					apply(target, thisArg, args) {
						if (currentCwd !== rootPath) {
							process.chdir(rootPath);
							currentCwd = rootPath;
						}
						return (target as any).apply(thisArg, args);
					}
				});
			}
			return fn;
		},
	});

	const fileExistsCache = new Map<string, boolean>();
	const directoryExistsCache = new Map<string, boolean>();
	const sysWithCache: Partial<typeof ts.sys> = {
		fileExists(path: string) {
			if (!fileExistsCache.has(path)) {
				fileExistsCache.set(path, ts.sys.fileExists(path));
			}
			return fileExistsCache.get(path)!;
		},
		directoryExists(path: string) {
			if (!directoryExistsCache.has(path)) {
				directoryExistsCache.set(path, ts.sys.directoryExists(path));
			}
			return directoryExistsCache.get(path)!;
		},
	};
	const sys: ts.System = capabilities.workspace?.didChangeWatchedFiles // don't cache fs result if client not supports file watcher
		? new Proxy(_workspaceSys, {
			get(target, prop) {
				if (prop in sysWithCache) {
					return sysWithCache[prop as keyof typeof sysWithCache];
				}
				return target[prop as keyof typeof target];
			},
		})
		: ts.sys;

	return {
		projects,
		findMatchConfigs,
		getProjectAndTsConfig,
		getProjectByCreate,
		getInferredProject,
		getInferredProjectDontCreate: () => inferredProject,
		clearFsCache: () => {
			fileExistsCache.clear();
			directoryExistsCache.clear();
		},
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
				sys,
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
				sys,
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

export function sortPaths(fileName: string, a: string, b: string) {

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
