import type { LanguageServer } from '@volar/language-server';
import { createLanguageServiceEnvironment } from '@volar/language-server/lib/project/simpleProject';
import { createConnection, createServer, loadTsdkByPath } from '@volar/language-server/node';
import { createLanguage, createParsedCommandLine, createVueLanguagePlugin, getDefaultCompilerOptions } from '@vue/language-core';
import { createLanguageService, createUriMap, getHybridModeLanguageServicePlugins, LanguageService } from '@vue/language-service';
import type * as ts from 'typescript';
import { URI } from 'vscode-uri';
import type { VueInitializationOptions } from './lib/types';

const connection = createConnection();
const server = createServer(connection);

connection.listen();

connection.onInitialize(params => {
	const options: VueInitializationOptions = params.initializationOptions;

	if (!options.typescript?.tsdk) {
		throw new Error('typescript.tsdk is required');
	}
	if (!options.typescript?.tsserverRequestCommand) {
		connection.console.warn('typescript.tsserverRequestCommand is required since >= 3.0 for complete TS features');
	}

	const { typescript: ts } = loadTsdkByPath(options.typescript.tsdk, params.locale);
	const tsconfigProjects = createUriMap<LanguageService>();
	const file2ProjectInfo = new Map<string, Promise<ts.server.protocol.ProjectInfo | null>>();

	server.fileWatcher.onDidChangeWatchedFiles(({ changes }) => {
		for (const change of changes) {
			const changeUri = URI.parse(change.uri);
			if (tsconfigProjects.has(changeUri)) {
				tsconfigProjects.get(changeUri)!.dispose();
				tsconfigProjects.delete(changeUri);
				file2ProjectInfo.clear();
			}
		}
	});

	let simpleLs: LanguageService | undefined;

	return server.initialize(
		params,
		{
			setup() { },
			async getLanguageService(uri) {
				if (uri.scheme === 'file' && options.typescript.tsserverRequestCommand) {
					const fileName = uri.fsPath.replace(/\\/g, '/');
					let projectInfoPromise = file2ProjectInfo.get(fileName);
					if (!projectInfoPromise) {
						projectInfoPromise = sendTsRequest<ts.server.protocol.ProjectInfo>(
							ts.server.protocol.CommandTypes.ProjectInfo,
							{
								file: fileName,
								needFileNameList: false,
							}
						);
						file2ProjectInfo.set(fileName, projectInfoPromise);
					}
					const projectInfo = await projectInfoPromise;
					if (projectInfo) {
						const { configFileName } = projectInfo;
						let ls = tsconfigProjects.get(URI.file(configFileName));
						if (!ls) {
							ls = createLs(server, configFileName);
							tsconfigProjects.set(URI.file(configFileName), ls);
						}
						return ls;
					}
				}
				return simpleLs ??= createLs(server, undefined);
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
					ls?.dispose();
				}
				tsconfigProjects.clear();
				simpleLs = undefined;
			},
		},
		getHybridModeLanguageServicePlugins(ts, options.typescript.tsserverRequestCommand ? {
			collectExtractProps(...args) {
				return sendTsRequest('vue:collectExtractProps', args);
			},
			getComponentDirectives(...args) {
				return sendTsRequest('vue:getComponentDirectives', args);
			},
			getComponentEvents(...args) {
				return sendTsRequest('vue:getComponentEvents', args);
			},
			getComponentNames(...args) {
				return sendTsRequest('vue:getComponentNames', args);
			},
			getComponentProps(...args) {
				return sendTsRequest('vue:getComponentProps', args);
			},
			getElementAttrs(...args) {
				return sendTsRequest('vue:getElementAttrs', args);
			},
			getElementNames(...args) {
				return sendTsRequest('vue:getElementNames', args);
			},
			getDocumentHighlights(...args) {
				return sendTsRequest('vue:getDocumentHighlights', args);
			},
			getImportPathForFile(...args) {
				return sendTsRequest('vue:getImportPathForFile', args);
			},
			getPropertiesAtLocation(...args) {
				return sendTsRequest('vue:getPropertiesAtLocation', args);
			},
			getQuickInfoAtPosition(...args) {
				return sendTsRequest('vue:getQuickInfoAtPosition', args);
			},
		} : undefined)
	);

	function sendTsRequest<T>(command: string, args: any): Promise<T | null> {
		return connection.sendRequest<T>(options.typescript.tsserverRequestCommand!, [command, args]);
	}

	function createLs(server: LanguageServer, tsconfig: string | undefined) {
		const commonLine = tsconfig
			? createParsedCommandLine(ts, ts.sys, tsconfig)
			: {
				options: ts.getDefaultCompilerOptions(),
				vueOptions: getDefaultCompilerOptions(),
			};
		const language = createLanguage<URI>(
			[
				{
					getLanguageId: uri => server.documents.get(uri)?.languageId,
				},
				createVueLanguagePlugin(
					ts,
					commonLine.options,
					commonLine.vueOptions,
					uri => uri.fsPath.replace(/\\/g, '/')
				),
			],
			createUriMap(),
			uri => {
				const document = server.documents.get(uri);
				if (document) {
					language.scripts.set(uri, document.getSnapshot(), document.languageId);
				}
				else {
					language.scripts.delete(uri);
				}
			}
		);
		return createLanguageService(
			language,
			server.languageServicePlugins,
			createLanguageServiceEnvironment(server, [...server.workspaceFolders.all]),
			{ vue: { compilerOptions: commonLine.vueOptions } }
		);
	}
});

connection.onInitialized(server.initialized);

connection.onShutdown(server.shutdown);
