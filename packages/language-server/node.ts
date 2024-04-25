import type { Connection } from '@volar/language-server';
import { createConnection, createServer, createTypeScriptProjectProviderFactory, loadTsdkByPath } from '@volar/language-server/node';
import { ParsedCommandLine, VueCompilerOptions, createParsedCommandLine, createVueLanguagePlugin, parse, resolveCommonLanguageId, resolveVueCompilerOptions } from '@vue/language-core';
import { ServiceEnvironment, convertAttrName, convertTagName, createDefaultGetTsPluginClient, createVueServicePlugins, detect } from '@vue/language-service';
import * as tsPluginClient from '@vue/typescript-plugin/lib/client';
import { searchNamedPipeServerForFile } from '@vue/typescript-plugin/lib/utils';
import { createHybridModeProjectProviderFactory } from './lib/hybridModeProject';
import { DetectNameCasingRequest, GetConnectedNamedPipeServerRequest, GetConvertAttrCasingEditsRequest, GetConvertTagCasingEditsRequest, ParseSFCRequest } from './lib/protocol';
import type { VueInitializationOptions } from './lib/types';

export const connection: Connection = createConnection();

export const server = createServer(connection);

const envToVueOptions = new WeakMap<ServiceEnvironment, VueCompilerOptions>();

let tsdk: ReturnType<typeof loadTsdkByPath>;
let getTsPluginClient: ReturnType<typeof createDefaultGetTsPluginClient>;

connection.listen();

connection.onInitialize(async params => {

	const options: VueInitializationOptions = params.initializationOptions;
	const hybridMode = options.vue?.hybridMode ?? true;
	const vueFileExtensions: string[] = ['vue'];

	tsdk = loadTsdkByPath(options.typescript.tsdk, params.locale);

	if (options.vue?.additionalExtensions) {
		for (const additionalExtension of options.vue.additionalExtensions) {
			vueFileExtensions.push(additionalExtension);
		}
	}

	if (hybridMode) {
		getTsPluginClient = () => tsPluginClient;
	}
	else {
		getTsPluginClient = createDefaultGetTsPluginClient(tsdk.typescript, env => envToVueOptions.get(env)!);
	}

	const result = await server.initialize(
		params,
		hybridMode
			? createHybridModeProjectProviderFactory(tsdk.typescript.sys)
			: createTypeScriptProjectProviderFactory(tsdk.typescript, tsdk.diagnosticMessages),
		{
			watchFileExtensions: ['js', 'cjs', 'mjs', 'ts', 'cts', 'mts', 'jsx', 'tsx', 'json', ...vueFileExtensions],
			getLanguageId(uri) {
				if (vueFileExtensions.some(ext => uri.endsWith(`.${ext}`))) {
					if (uri.endsWith('.html')) {
						return 'html';
					}
					else if (uri.endsWith('.md')) {
						return 'markdown';
					}
					else {
						return 'vue';
					}
				}
				return resolveCommonLanguageId(uri);
			},
			getServicePlugins() {
				return createVueServicePlugins(
					tsdk.typescript,
					env => envToVueOptions.get(env)!,
					getTsPluginClient,
					hybridMode,
				);
			},
			async getLanguagePlugins(serviceEnv, projectContext) {
				const commandLine = await parseCommandLine();
				const vueOptions = commandLine?.vueOptions ?? resolveVueCompilerOptions({});
				for (const ext of vueFileExtensions) {
					if (!vueOptions.extensions.includes(`.${ext}`)) {
						vueOptions.extensions.push(`.${ext}`);
					}
				}
				const vueLanguagePlugin = createVueLanguagePlugin(
					tsdk.typescript,
					serviceEnv.typescript!.uriToFileName,
					projectContext.typescript?.sys.useCaseSensitiveFileNames ?? false,
					() => projectContext.typescript?.host.getProjectVersion?.() ?? '',
					() => projectContext.typescript?.host.getScriptFileNames() ?? [],
					commandLine?.options ?? {},
					vueOptions,
				);

				envToVueOptions.set(serviceEnv, vueOptions);

				return [vueLanguagePlugin];

				async function parseCommandLine() {

					let commandLine: ParsedCommandLine | undefined;

					if (projectContext.typescript) {

						const { sys } = projectContext.typescript;

						let sysVersion: number | undefined;
						let newSysVersion = await sys.sync();

						while (sysVersion !== newSysVersion) {
							sysVersion = newSysVersion;
							if (projectContext.typescript.configFileName) {
								commandLine = createParsedCommandLine(tsdk.typescript, sys, projectContext.typescript.configFileName);
							}
							newSysVersion = await sys.sync();
						}
					}

					return commandLine;
				}
			},
		},
	);

	if (hybridMode) {
		// handle by tsserver + @vue/typescript-plugin
		result.capabilities.semanticTokensProvider = undefined;
	}

	return result;
});

connection.onInitialized(() => {
	server.initialized();
});

connection.onShutdown(() => {
	server.shutdown();
});

connection.onRequest(ParseSFCRequest.type, params => {
	return parse(params);
});

connection.onRequest(DetectNameCasingRequest.type, async params => {
	const languageService = await getService(params.textDocument.uri);
	if (languageService) {
		return await detect(languageService.context, params.textDocument.uri);
	}
});

connection.onRequest(GetConvertTagCasingEditsRequest.type, async params => {
	const languageService = await getService(params.textDocument.uri);
	if (languageService) {
		return await convertTagName(languageService.context, params.textDocument.uri, params.casing, getTsPluginClient(languageService.context));
	}
});

connection.onRequest(GetConvertAttrCasingEditsRequest.type, async params => {
	const languageService = await getService(params.textDocument.uri);
	if (languageService) {
		return await convertAttrName(languageService.context, params.textDocument.uri, params.casing, getTsPluginClient(languageService.context));
	}
});

connection.onRequest(GetConnectedNamedPipeServerRequest.type, async fileName => {
	const server = (await searchNamedPipeServerForFile(fileName))?.server;
	if (server) {
		return server;
	}
});

async function getService(uri: string) {
	return (await server.projects.getProject(uri)).getLanguageService();
}
