import type { LanguagePlugin, LanguageServicePlugin, ServerProject, ServerProjectProviderFactory } from '@volar/language-server';
import { createSimpleServerProject } from '@volar/language-server/lib/project/simpleProject';
import { createServiceEnvironment, getWorkspaceFolder } from '@volar/language-server/lib/project/simpleProjectProvider';
import type { ServerContext } from '@volar/language-server/lib/server';
import { FileMap, createLanguage } from '@vue/language-core';
import { LanguageService, ServiceEnvironment, createLanguageService } from '@vue/language-service';
import { searchNamedPipeServerForFile } from '@vue/typescript-plugin/lib/utils';
import type * as ts from 'typescript';

export function createHybridModeProjectProviderFactory(sys: ts.System): ServerProjectProviderFactory {
	return (context, servicePlugins, getLanguagePlugins) => {
		const serviceEnvs = new FileMap<ServiceEnvironment>(sys.useCaseSensitiveFileNames);
		const tsconfigProjects = new FileMap<Promise<ServerProject>>(sys.useCaseSensitiveFileNames);
		const simpleProjects = new FileMap<Promise<ServerProject>>(sys.useCaseSensitiveFileNames);
		context.onDidChangeWatchedFiles(({ changes }) => {
			for (const change of changes) {
				if (tsconfigProjects.has(change.uri)) {
					tsconfigProjects.get(change.uri)?.then(project => project.dispose());
					tsconfigProjects.delete(change.uri);
					context.reloadDiagnostics();
				}
			}
		});
		return {
			async getProject(uri): Promise<ServerProject> {
				const workspaceFolder = getWorkspaceFolder(uri, context.workspaceFolders);
				let serviceEnv = serviceEnvs.get(workspaceFolder);
				if (!serviceEnv) {
					serviceEnv = createServiceEnvironment(context, workspaceFolder);
					serviceEnvs.set(workspaceFolder, serviceEnv);
				}
				const fileName = serviceEnv.typescript!.uriToFileName(uri);
				const projectInfo = (await searchNamedPipeServerForFile(fileName))?.projectInfo;
				if (projectInfo?.kind === 1) {
					const tsconfig = projectInfo.name;
					const tsconfigUri = serviceEnv.typescript!.fileNameToUri(tsconfig);
					if (!tsconfigProjects.has(tsconfigUri)) {
						tsconfigProjects.set(tsconfigUri, (async () => {
							const languagePlugins = await getLanguagePlugins(serviceEnv, {
								typescript: {
									configFileName: tsconfig,
									host: {
										getScriptFileNames() {
											return [];
										},
									} as any,
									sys: {
										...sys,
										version: 0,
										async sync() {
											return 0;
										},
										dispose() { },
									},
								},
							});
							return createTSConfigProject(context, serviceEnv, languagePlugins, servicePlugins);
						})());
					}
					return await tsconfigProjects.get(tsconfigUri)!;
				}
				else {
					if (!simpleProjects.has(workspaceFolder)) {
						simpleProjects.set(workspaceFolder, (() => {
							return createSimpleServerProject(context, serviceEnv, servicePlugins, getLanguagePlugins);
						})());
					}
					return await simpleProjects.get(workspaceFolder)!;
				}
			},
			async getProjects() {
				return Promise.all([
					...tsconfigProjects.values(),
					...simpleProjects.values(),
				]);
			},
			async reloadProjects() {
				for (const project of [
					...tsconfigProjects.values(),
					...simpleProjects.values(),
				]) {
					(await project).dispose();
				}
				tsconfigProjects.clear();
			},
		};

		function createTSConfigProject(
			context: ServerContext,
			serviceEnv: ServiceEnvironment,
			languagePlugins: LanguagePlugin[],
			servicePlugins: LanguageServicePlugin[],
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
						const script = context.documents.get(uri);
						if (script) {
							language.scripts.set(uri, script.languageId, script.getSnapshot());
						}
						else {
							language.scripts.delete(uri);
						}
					});
					languageService = createLanguageService(
						language,
						servicePlugins,
						serviceEnv,
					);
				}
				return languageService;
			}
		}
	};
}
