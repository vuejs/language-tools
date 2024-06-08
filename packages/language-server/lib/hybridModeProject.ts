import type { LanguagePlugin, LanguageServer, LanguageServerProject, ProviderResult } from '@volar/language-server';
import { createLanguageServiceEnvironment } from '@volar/language-server/lib/project/simpleProject';
import { createLanguage } from '@vue/language-core';
import { Disposable, LanguageService, LanguageServiceEnvironment, createLanguageService, createUriMap } from '@vue/language-service';
import { searchNamedPipeServerForFile, TypeScriptProjectHost } from '@vue/typescript-plugin/lib/utils';
import type * as ts from 'typescript';
import { URI } from 'vscode-uri';

export type GetLanguagePlugin<T> = (params: {
	serviceEnv: LanguageServiceEnvironment,
	asFileName: (scriptId: T) => string,
	configFileName?: string,
	projectHost?: TypeScriptProjectHost,
	sys?: ts.System & {
		version: number;
		sync(): Promise<number>;
	} & Disposable,
}) => ProviderResult<LanguagePlugin<URI>[]>;

export function createHybridModeProject(
	sys: ts.System,
	getLanguagePlugins: GetLanguagePlugin<URI>
): LanguageServerProject {
	let initialized = false;
	let simpleLs: Promise<LanguageService> | undefined;
	let serviceEnv: LanguageServiceEnvironment | undefined;
	let server: LanguageServer;

	const tsconfigProjects = createUriMap<Promise<LanguageService>>(sys.useCaseSensitiveFileNames);

	return {
		setup(_server) {
			server = _server;
		},
		async getLanguageService(uri) {
			if (!initialized) {
				initialized = true;
				initialize(server);
			}
			const fileName = asFileName(uri);
			const projectInfo = (await searchNamedPipeServerForFile(fileName))?.projectInfo;
			if (projectInfo?.kind === 1) {
				const tsconfig = projectInfo.name;
				const tsconfigUri = URI.file(tsconfig);
				if (!tsconfigProjects.has(tsconfigUri)) {
					tsconfigProjects.set(tsconfigUri, (async () => {
						serviceEnv ??= createLanguageServiceEnvironment(server, [...server.workspaceFolders.keys()]);
						const languagePlugins = await getLanguagePlugins({
							serviceEnv,
							configFileName: tsconfig,
							sys: {
								...sys,
								version: 0,
								async sync() {
									return await 0;
								},
								dispose() { },
							},
							asFileName,
						});
						return createLs(server, serviceEnv, languagePlugins);
					})());
				}
				return await tsconfigProjects.get(tsconfigUri)!;
			}
			else {
				simpleLs ??= (async () => {
					serviceEnv ??= createLanguageServiceEnvironment(server, [...server.workspaceFolders.keys()]);
					const languagePlugins = await getLanguagePlugins({ serviceEnv, asFileName });
					return createLs(server, serviceEnv, languagePlugins);
				})();
				return await simpleLs;
			}
		},
		getExistingLanguageServices() {
			return Promise.all([
				...tsconfigProjects.values(),
				simpleLs,
			].filter(notEmpty));
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

	function asFileName(uri: URI) {
		return uri.fsPath.replace(/\\/g, '/');
	}

	function initialize(server: LanguageServer) {
		server.onDidChangeWatchedFiles(({ changes }) => {
			for (const change of changes) {
				const changeUri = URI.parse(change.uri);
				if (tsconfigProjects.has(changeUri)) {
					tsconfigProjects.get(changeUri)?.then(project => project.dispose());
					tsconfigProjects.delete(changeUri);
					server.clearPushDiagnostics();
				}
			}
		});
	}

	function createLs(
		server: LanguageServer,
		serviceEnv: LanguageServiceEnvironment,
		languagePlugins: LanguagePlugin<URI>[]
	) {
		const language = createLanguage([
			{ getLanguageId: uri => server.documents.get(server.getSyncedDocumentKey(uri) ?? uri.toString())?.languageId },
			...languagePlugins,
		], createUriMap(), uri => {
			const documentKey = server.getSyncedDocumentKey(uri);
			const document = documentKey ? server.documents.get(documentKey) : undefined;
			if (document) {
				language.scripts.set(uri, document.getSnapshot(), document.languageId);
			}
			else {
				language.scripts.delete(uri);
			}
		});
		return createLanguageService(
			language,
			server.languageServicePlugins,
			serviceEnv
		);
	}
}

export function notEmpty<T>(value: T | null | undefined): value is T {
	return value !== null && value !== undefined;
}
