import type { Language, LanguagePlugin, LanguageServer, LanguageServerProject, ProjectContext, ProviderResult } from '@volar/language-server';
import { createLanguageServiceEnvironment } from '@volar/language-server/lib/project/simpleProject';
import { createLanguage } from '@vue/language-core';
import { createLanguageService, createUriMap, LanguageService } from '@vue/language-service';
import { getReadyNamedPipePaths, onSomePipeReadyCallbacks, searchNamedPipeServerForFile } from '@vue/typescript-plugin/lib/utils';
import { URI } from 'vscode-uri';

export function createHybridModeProject(
	create: (params: {
		configFileName?: string;
		asFileName: (scriptId: URI) => string;
	}) => ProviderResult<{
		languagePlugins: LanguagePlugin<URI>[];
		setup?(options: {
			language: Language;
			project: ProjectContext;
		}): void;
	}>
): LanguageServerProject {
	let simpleLs: Promise<LanguageService> | undefined;
	let server: LanguageServer;

	const tsconfigProjects = createUriMap<Promise<LanguageService>>();
	const project: LanguageServerProject = {
		setup(_server) {
			server = _server;
			onSomePipeReadyCallbacks.push(() => {
				server.languageFeatures.requestRefresh(false);
			});
			server.fileWatcher.onDidChangeWatchedFiles(({ changes }) => {
				for (const change of changes) {
					const changeUri = URI.parse(change.uri);
					if (tsconfigProjects.has(changeUri)) {
						tsconfigProjects.get(changeUri)?.then(project => project.dispose());
						tsconfigProjects.delete(changeUri);
					}
				}
			});
			const end = Date.now() + 60000;
			const pipeWatcher = setInterval(() => {
				getReadyNamedPipePaths();
				if (Date.now() > end) {
					clearInterval(pipeWatcher);
				}
			}, 1000);
		},
		async getLanguageService(uri) {
			const fileName = asFileName(uri);
			const namedPipeServer = (await searchNamedPipeServerForFile(fileName));
			namedPipeServer?.socket.end();
			if (namedPipeServer?.projectInfo?.kind === 1) {
				const tsconfig = namedPipeServer.projectInfo.name;
				const tsconfigUri = URI.file(tsconfig);
				if (!tsconfigProjects.has(tsconfigUri)) {
					tsconfigProjects.set(tsconfigUri, createLs(server, tsconfig));
				}
				return await tsconfigProjects.get(tsconfigUri)!;
			}
			else {
				simpleLs ??= createLs(server, undefined);
				return await simpleLs;
			}
		},
		getExistingLanguageServices() {
			return Promise.all([
				...tsconfigProjects.values(),
				simpleLs,
			].filter(promise => !!promise));
		},
		reload() {
			for (const ls of [
				...tsconfigProjects.values(),
				simpleLs,
			]) {
				ls?.then(ls => ls.dispose());
			}
			tsconfigProjects.clear();
			simpleLs = undefined;
		},
	};

	return project;

	function asFileName(uri: URI) {
		return uri.fsPath.replace(/\\/g, '/');
	}

	async function createLs(server: LanguageServer, tsconfig: string | undefined) {
		const { languagePlugins, setup } = await create({
			configFileName: tsconfig,
			asFileName,
		});
		const language = createLanguage([
			{ getLanguageId: uri => server.documents.get(uri)?.languageId },
			...languagePlugins,
		], createUriMap(), uri => {
			const document = server.documents.get(uri);
			if (document) {
				language.scripts.set(uri, document.getSnapshot(), document.languageId);
			}
			else {
				language.scripts.delete(uri);
			}
		});
		const project: ProjectContext = {};
		setup?.({ language, project });
		return createLanguageService(
			language,
			server.languageServicePlugins,
			createLanguageServiceEnvironment(server, [...server.workspaceFolders.all]),
			project
		);
	}
}
