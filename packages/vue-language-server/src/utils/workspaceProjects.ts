import * as shared from '@volar/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as path from 'upath';
import * as vscode from 'vscode-languageserver';
import { createProject, Project } from './project';
import type { createConfigurationHost } from './configurationHost';
import { LanguageConfigs, RuntimeEnvironment, FileSystemHost, ServerInitializationOptions } from '../types';
import { createSnapshots } from './snapshots';
import { getInferredCompilerOptions } from './inferredCompilerOptions';
import { URI } from 'vscode-uri';

export const rootTsConfigNames = ['tsconfig.json', 'jsconfig.json'];

export async function createWorkspaceProjects(
	runtimeEnv: RuntimeEnvironment,
	languageConfigs: LanguageConfigs,
	fsHost: FileSystemHost,
	rootUri: URI,
	ts: typeof import('typescript/lib/tsserverlibrary'),
	tsLocalized: ts.MapLike<string> | undefined,
	options: ServerInitializationOptions,
	documents: ReturnType<typeof createSnapshots>,
	connection: vscode.Connection,
	configHost: ReturnType<typeof createConfigurationHost> | undefined,
) {

	let inferredProject: Project | undefined;

	const sys = fsHost.getWorkspaceFileSystem(rootUri);
	const inferOptions = await getInferredCompilerOptions(ts, configHost);
	const projects = shared.createUriAndPathMap<Project>(rootUri);
	const rootTsConfigs = new Set(sys.readDirectory(rootUri.path, rootTsConfigNames, undefined, ['**/*']));

	const disposeWatch = fsHost.onDidChangeWatchedFiles(async params => {
		const disposes: Promise<any>[] = [];
		for (const change of params.changes) {
			if (rootTsConfigNames.includes(path.basename(change.uri))) {
				if (change.type === vscode.FileChangeType.Created) {
					if (change.uri.toLowerCase().startsWith(rootUri.toString().toLowerCase())) {
						rootTsConfigs.add(URI.parse(change.uri).path);
					}
				}
				else if ((change.type === vscode.FileChangeType.Changed || change.type === vscode.FileChangeType.Deleted) && projects.uriHas(change.uri)) {
					if (change.type === vscode.FileChangeType.Deleted) {
						rootTsConfigs.delete(change.uri);
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
		getProjectAndTsConfig,
		getInferredProject,
		async reload() {
			(await inferredProject)?.dispose();
			inferredProject = undefined;
			for (const project of projects.values()) {
				(await project).dispose();
			}
			projects.clear();
		},
		async dispose() {
			(await inferredProject)?.dispose();
			inferredProject = undefined;
			for (const project of projects.values()) {
				(await project).dispose();
			}
			projects.clear();
			disposeWatch();
		},
	};

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
			inferredProject = createProject(
				runtimeEnv,
				languageConfigs,
				fsHost,
				sys,
				ts,
				options,
				rootUri,
				rootUri.path,
				inferOptions,
				tsLocalized,
				documents,
				connection,
				configHost,
			);
		}
		return inferredProject;
	}
	async function findMatchConfigs(uri: URI) {

		await prepareClosestootParsedCommandLine();

		return await findDirectIncludeTsconfig() ?? await findIndirectReferenceTsconfig();

		async function prepareClosestootParsedCommandLine() {

			let matches: string[] = [];

			for (const rootTsConfig of rootTsConfigs) {
				if (uri.path.toLowerCase().startsWith(path.dirname(rootTsConfig).toLowerCase())) {
					matches.push(rootTsConfig);
				}
			}

			matches = matches.sort((a, b) => sortTsConfigs(uri.path, a, b));

			if (matches.length) {
				await getParsedCommandLine(matches[0]);
			}
		}
		function findDirectIncludeTsconfig() {
			return findTsconfig(async tsconfig => {
				const parsedCommandLine = await getParsedCommandLine(tsconfig);
				// use toLowerCase to fix https://github.com/johnsoncodehk/volar/issues/1125
				const fileNames = new Set(parsedCommandLine.fileNames.map(fileName => fileName.toLowerCase()));
				return fileNames.has(uri.path.toLowerCase());
			});
		}
		function findIndirectReferenceTsconfig() {
			return findTsconfig(async tsconfig => {
				const project = await projects.pathGet(tsconfig);
				const ls = await project?.getLanguageServiceDontCreate();
				const validDoc = ls?.__internal__.context.getTsLs().__internal__.getValidTextDocument(uri.toString());
				return !!validDoc;
			});
		}
		async function findTsconfig(match: (tsconfig: string) => Promise<boolean> | boolean) {

			const checked = new Set<string>();

			for (const rootTsConfig of [...rootTsConfigs].sort((a, b) => sortTsConfigs(uri.path, a, b))) {
				const project = await projects.pathGet(rootTsConfig);
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
					if (!sys.fileExists(tsConfigPath)) {
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
		let project = projects.pathGet(tsConfig);
		if (!project) {
			project = createProject(
				runtimeEnv,
				languageConfigs,
				fsHost,
				sys,
				ts,
				options,
				rootUri,
				path.dirname(tsConfig),
				tsConfig,
				tsLocalized,
				documents,
				connection,
				configHost,
			);
			projects.pathSet(tsConfig, project);
		}
		return project;
	}
}

export function sortTsConfigs(uri: string, a: string, b: string) {

	const inA = uri.toLowerCase().startsWith(path.dirname(a).toLowerCase());
	const inB = uri.toLowerCase().startsWith(path.dirname(b).toLowerCase());

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
