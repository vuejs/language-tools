import type { Language, LanguagePlugin, LanguageServer, LanguageServerProject, ProjectContext, ProviderResult } from '@volar/language-server';
import { createLanguageServiceEnvironment } from '@volar/language-server/lib/project/simpleProject';
import { createLanguage } from '@vue/language-core';
import { createLanguageService, createUriMap, LanguageService } from '@vue/language-service';
import { URI } from 'vscode-uri';

export function createHybridModeProject(
	create: () => ProviderResult<{
		languagePlugins: LanguagePlugin<URI>[];
		setup?(options: {
			language: Language;
			project: ProjectContext;
		}): void;
	}>
) {
	let simpleLs: Promise<LanguageService> | undefined;
	let server: LanguageServer;

	const tsconfigProjects = createUriMap<Promise<LanguageService>>();
	const project: LanguageServerProject = {
		setup(_server) {
			server = _server;
			server.fileWatcher.onDidChangeWatchedFiles(({ changes }) => {
				for (const change of changes) {
					const changeUri = URI.parse(change.uri);
					if (tsconfigProjects.has(changeUri)) {
						tsconfigProjects.get(changeUri)?.then(project => project.dispose());
						tsconfigProjects.delete(changeUri);
					}
				}
			});
		},
		async getLanguageService() {
			simpleLs ??= createLs(server);
			return await simpleLs;
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

	async function createLs(server: LanguageServer) {
		const { languagePlugins, setup } = await create();
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
