import type { LanguagePlugin, ProviderResult, ServerBase, ServerProject, ServerProjectProvider, TypeScriptProjectHost } from '@volar/language-server';
import { createSimpleServerProject } from '@volar/language-server/lib/project/simpleProject';
import { createServiceEnvironment, getWorkspaceFolder } from '@volar/language-server/lib/project/simpleProjectProvider';
import { FileMap, createLanguage } from '@vue/language-core';
import { Disposable, LanguageService, ServiceEnvironment, createLanguageService } from '@vue/language-service';
import { searchNamedPipeServerForFile } from '@vue/typescript-plugin/lib/utils';
import type * as ts from 'typescript';

export type GetLanguagePlugin = (
	serviceEnv: ServiceEnvironment,
	configFileName?: string,
	host?: TypeScriptProjectHost,
	sys?: ts.System & {
		version: number;
		sync(): Promise<number>;
	} & Disposable,
) => ProviderResult<LanguagePlugin[]>;

export function createHybridModeProjectProviderFactory(
	sys: ts.System,
	getLanguagePlugins: GetLanguagePlugin,
): ServerProjectProvider {
	let initialized = false;

	const serviceEnvs = new FileMap<ServiceEnvironment>(sys.useCaseSensitiveFileNames);
	const tsconfigProjects = new FileMap<Promise<ServerProject>>(sys.useCaseSensitiveFileNames);
	const simpleProjects = new FileMap<Promise<ServerProject>>(sys.useCaseSensitiveFileNames);

	return {
		async get(uri): Promise<ServerProject> {
			if (!initialized) {
				initialized = true;
				initialize(this);
			}
			const workspaceFolder = getWorkspaceFolder(uri, this.workspaceFolders);
			let serviceEnv = serviceEnvs.get(workspaceFolder);
			if (!serviceEnv) {
				serviceEnv = createServiceEnvironment(this, workspaceFolder);
				serviceEnvs.set(workspaceFolder, serviceEnv);
			}
			const fileName = serviceEnv.typescript!.uriToFileName(uri);
			const projectInfo = (await searchNamedPipeServerForFile(fileName))?.projectInfo;
			if (projectInfo?.kind === 1) {
				const tsconfig = projectInfo.name;
				const tsconfigUri = serviceEnv.typescript!.fileNameToUri(tsconfig);
				if (!tsconfigProjects.has(tsconfigUri)) {
					tsconfigProjects.set(tsconfigUri, (async () => {
						const languagePlugins = await getLanguagePlugins(serviceEnv, tsconfig, undefined, {
							...sys,
							version: 0,
							async sync() {
								return 0;
							},
							dispose() { },
						});
						return createTSConfigProject(this, serviceEnv, languagePlugins);
					})());
				}
				return await tsconfigProjects.get(tsconfigUri)!;
			}
			else {
				if (!simpleProjects.has(workspaceFolder)) {
					simpleProjects.set(workspaceFolder, (async () => {
						const languagePlugins = await getLanguagePlugins(serviceEnv);
						return createSimpleServerProject(this, serviceEnv, languagePlugins);
					})());
				}
				return await simpleProjects.get(workspaceFolder)!;
			}
		},
		async all() {
			return Promise.all([
				...tsconfigProjects.values(),
				...simpleProjects.values(),
			]);
		},
	};

	function initialize(server: ServerBase) {
		server.onDidChangeWatchedFiles(({ changes }) => {
			for (const change of changes) {
				if (tsconfigProjects.has(change.uri)) {
					tsconfigProjects.get(change.uri)?.then(project => project.dispose());
					tsconfigProjects.delete(change.uri);
					server.clearPushDiagnostics();
				}
			}
		});
	}

	function createTSConfigProject(
		server: ServerBase,
		serviceEnv: ServiceEnvironment,
		languagePlugins: LanguagePlugin[],
	): ServerProject {

		let languageService: LanguageService | undefined;

		return {
			getLanguageService,
			getLanguageServiceDontCreate: () => languageService,
			dispose() {
				languageService?.dispose();
			},
		};

		function getLanguageService() {
			if (!languageService) {
				const language = createLanguage(languagePlugins, false, uri => {
					const document = server.documents.get(uri);
					if (document) {
						language.scripts.set(uri, document.getSnapshot(), document.languageId);
					}
					else {
						language.scripts.delete(uri);
					}
				});
				languageService = createLanguageService(
					language,
					server.languageServicePlugins,
					serviceEnv,
				);
			}
			return languageService;
		}
	}
}
