import * as shared from '@volar/shared';
import * as path from 'typesafe-path';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as vscode from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { createProject, Project } from './project';
import { getInferredCompilerOptions } from './utils/inferredCompilerOptions';
import { createUriMap } from './utils/uriMap';
import { WorkspacesParams } from './workspaces';

export const rootTsConfigNames = ['tsconfig.json', 'jsconfig.json'];

export interface WorkspaceParams {
	workspaces: WorkspacesParams;
	rootUri: URI,
}

export async function createWorkspace(params: WorkspaceParams) {

	const { rootUri } = params;
	const { ts, fileSystemHost, initOptions, configurationHost } = params.workspaces;

	let inferredProject: Project | undefined;

	const sys = fileSystemHost.getWorkspaceFileSystem(rootUri);
	const documentRegistry = ts.createDocumentRegistry(sys.useCaseSensitiveFileNames, shared.getPathOfUri(rootUri.toString()));
	const projects = createUriMap<Project>();
	const rootTsConfigs = new Set(sys.readDirectory(shared.getPathOfUri(rootUri.toString()), rootTsConfigNames, undefined, ['**/*']).map(fileName => shared.normalizeFileName(fileName)));
	const disposeWatch = fileSystemHost.onDidChangeWatchedFiles(async (params) => {
		const disposes: Promise<any>[] = [];
		for (const change of params.changes) {
			if (rootTsConfigNames.includes(change.uri.substring(change.uri.lastIndexOf('/') + 1))) {
				if (change.type === vscode.FileChangeType.Created) {
					if (shared.isFileInDir(shared.getPathOfUri(change.uri), shared.getPathOfUri(rootUri.toString()))) {
						rootTsConfigs.add(shared.getPathOfUri(change.uri));
					}
				}
				else if ((change.type === vscode.FileChangeType.Changed || change.type === vscode.FileChangeType.Deleted) && projects.uriHas(change.uri)) {
					if (change.type === vscode.FileChangeType.Deleted) {
						rootTsConfigs.delete(shared.getPathOfUri(change.uri));
					}
					const _project = projects.uriGet(change.uri);
					projects.uriDelete(change.uri);
					disposes.push((async () => {
						(await _project)?.dispose();
					})());
				}
			}
		}
		return Promise.all(disposes);
	});

	return {
		projects,
		documentRegistry,
		getProjectAndTsConfig,
		getInferredProject,
		getInferredProjectDontCreate: () => inferredProject,
		reload: clearProjects,
		dispose() {
			clearProjects();
			disposeWatch();
		},
	};

	function clearProjects() {
		const _projects = [
			inferredProject,
			...projects.values(),
		];
		_projects.forEach(async project => {
			(await project)?.dispose();
		});
		inferredProject = undefined;
		projects.clear();
	}

	async function getProjectAndTsConfig(uri: string) {
		const tsconfig = await findMatchConfigs(URI.parse(uri));
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
			inferredProject = (async () => {
				const inferOptions = await getInferredCompilerOptions(ts, configurationHost);
				return createProject({
					workspace: params,
					rootUri,
					tsConfig: inferOptions,
					documentRegistry,
				});
			})();
		}
		return inferredProject;
	}
	async function findMatchConfigs(uri: URI) {

		await prepareClosestootParsedCommandLine();

		return await findDirectIncludeTsconfig() ?? await findIndirectReferenceTsconfig();

		async function prepareClosestootParsedCommandLine() {

			let matches: path.PosixPath[] = [];

			for (const rootTsConfig of rootTsConfigs) {
				if (shared.isFileInDir(shared.getPathOfUri(uri.toString()), path.dirname(rootTsConfig))) {
					matches.push(rootTsConfig);
				}
			}

			matches = matches.sort((a, b) => sortTsConfigs(shared.getPathOfUri(uri.toString()), a, b));

			if (matches.length) {
				await getParsedCommandLine(matches[0]);
			}
		}
		function findDirectIncludeTsconfig() {
			return findTsconfig(async tsconfig => {
				const map = createUriMap<boolean>();
				const parsedCommandLine = await getParsedCommandLine(tsconfig);
				for (const fileName of parsedCommandLine.fileNames) {
					map.pathSet(fileName, true);
				}
				return map.uriHas(uri.toString());
			});
		}
		function findIndirectReferenceTsconfig() {
			return findTsconfig(async tsconfig => {
				const project = await projects.pathGet(tsconfig);
				const ls = project?.getLanguageServiceDontCreate();
				const validDoc = ls?.context.typescriptLanguageService.getProgram()?.getSourceFile(shared.getPathOfUri(uri.toString()));
				return !!validDoc;
			});
		}
		async function findTsconfig(match: (tsconfig: string) => Promise<boolean> | boolean) {

			const checked = new Set<string>();


			for (const rootTsConfig of [...rootTsConfigs].sort((a, b) => sortTsConfigs(shared.getPathOfUri(uri.toString()), a, b))) {
				const project = await projects.pathGet(rootTsConfig);
				if (project) {

					let chains = await getReferencesChains(project.getParsedCommandLine(), rootTsConfig, []);

					if (initOptions.reverseConfigFilePriority) {
						chains = chains.reverse();
					}

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
					if (!sys.fileExists(tsConfigPath)) {
						const newTsConfigPath = path.join(tsConfigPath as path.OsPath, 'tsconfig.json' as path.PosixPath);
						const newJsConfigPath = path.join(tsConfigPath as path.OsPath, 'jsconfig.json' as path.PosixPath);
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
	function getProjectByCreate(_tsConfig: string) {
		const tsConfig = shared.normalizeFileName(_tsConfig);
		let project = projects.pathGet(tsConfig);
		if (!project) {
			project = createProject({
				workspace: params,
				rootUri: URI.parse(shared.getUriByPath(path.dirname(tsConfig))),
				tsConfig,
				documentRegistry,
			});
			projects.pathSet(tsConfig, project);
		}
		return project;
	}
}

export function sortTsConfigs(file: path.PosixPath, a: path.PosixPath, b: path.PosixPath) {

	const inA = shared.isFileInDir(file, path.dirname(a));
	const inB = shared.isFileInDir(file, path.dirname(b));

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
