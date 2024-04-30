import type { Connection } from '@volar/language-server';
import { createConnection, createServer, createTypeScriptProjectProvider, loadTsdkByPath } from '@volar/language-server/node';
import { ParsedCommandLine, VueCompilerOptions, createParsedCommandLine, createVueLanguagePlugin, parse, resolveVueCompilerOptions } from '@vue/language-core';
import { ServiceEnvironment, convertAttrName, convertTagName, createDefaultGetTsPluginClient, detect, getVueLanguageServicePlugins } from '@vue/language-service';
import * as tsPluginClient from '@vue/typescript-plugin/lib/client';
import { searchNamedPipeServerForFile } from '@vue/typescript-plugin/lib/utils';
import { GetLanguagePlugin, createHybridModeProjectProviderFactory } from './lib/hybridModeProject';
import { DetectNameCasingRequest, GetConnectedNamedPipeServerRequest, GetConvertAttrCasingEditsRequest, GetConvertTagCasingEditsRequest, ParseSFCRequest } from './lib/protocol';
import type { VueInitializationOptions } from './lib/types';

let tsdk: ReturnType<typeof loadTsdkByPath>;
let hybridMode: boolean;
let getTsPluginClient: ReturnType<typeof createDefaultGetTsPluginClient>;

const envToVueOptions = new WeakMap<ServiceEnvironment, VueCompilerOptions>();
const watchedExtensions = new Set<string>();

export const connection: Connection = createConnection();

export const server = createServer(connection);

export const getLanguagePlugins: GetLanguagePlugin = async (serviceEnv, configFileName, host, sys) => {
	const commandLine = await parseCommandLine();
	const vueOptions = commandLine?.vueOptions ?? resolveVueCompilerOptions({});
	const vueLanguagePlugin = createVueLanguagePlugin(
		tsdk.typescript,
		serviceEnv.typescript!.uriToFileName,
		sys?.useCaseSensitiveFileNames ?? false,
		() => host?.getProjectVersion?.() ?? '',
		() => host?.getScriptFileNames() ?? [],
		commandLine?.options ?? {},
		vueOptions,
	);
	if (!hybridMode) {
		const extensions = [
			'js', 'cjs', 'mjs', 'ts', 'cts', 'mts', 'jsx', 'tsx', 'json',
			...vueOptions.extensions.map(ext => ext.slice(1)),
			...vueOptions.vitePressExtensions.map(ext => ext.slice(1)),
			...vueOptions.petiteVueExtensions.map(ext => ext.slice(1)),
		];
		const newExtensions = extensions.filter(ext => !watchedExtensions.has(ext));
		if (newExtensions.length) {
			for (const ext of newExtensions) {
				watchedExtensions.add(ext);
			}
			server.watchFiles(['**/*.{' + newExtensions.join(',') + '}']);
		}
	}

	envToVueOptions.set(serviceEnv, vueOptions);

	return [vueLanguagePlugin];

	async function parseCommandLine() {
		let commandLine: ParsedCommandLine | undefined;
		let sysVersion: number | undefined;
		if (sys) {
			let newSysVersion = await sys.sync();
			while (sysVersion !== newSysVersion) {
				sysVersion = newSysVersion;
				if (configFileName) {
					commandLine = createParsedCommandLine(tsdk.typescript, sys, configFileName);
				}
				newSysVersion = await sys.sync();
			}
		}
		return commandLine;
	}
};

connection.listen();

connection.onInitialize(params => {
	const options: VueInitializationOptions = params.initializationOptions;

	hybridMode = options.vue?.hybridMode ?? true;
	tsdk = loadTsdkByPath(options.typescript.tsdk, params.locale);

	if (hybridMode) {
		getTsPluginClient = () => tsPluginClient;
	}
	else {
		getTsPluginClient = createDefaultGetTsPluginClient(tsdk.typescript, env => envToVueOptions.get(env)!);
	}

	const result = server.initialize(
		params,
		getVueLanguageServicePlugins(
			tsdk.typescript,
			env => envToVueOptions.get(env)!,
			getTsPluginClient,
			hybridMode,
		),
		hybridMode
			? createHybridModeProjectProviderFactory(tsdk.typescript.sys, getLanguagePlugins)
			: createTypeScriptProjectProvider(tsdk.typescript, tsdk.diagnosticMessages, (env, ctx) => getLanguagePlugins(env, ctx.configFileName, ctx.host, ctx.sys)),
		{
			pullModelDiagnostics: hybridMode,
		},
	);
	if (hybridMode) {
		// provided by tsserver + @vue/typescript-plugin
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
	return (await server.projects.get.call(server, uri)).getLanguageService();
}
