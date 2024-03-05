import type { Connection } from '@volar/language-server';
import { createConnection, createServer, createSimpleProjectProviderFactory, loadTsdkByPath } from '@volar/language-server/node';
import { ParsedCommandLine, VueCompilerOptions, createParsedCommandLine, createVueLanguagePlugin, parse, resolveVueCompilerOptions } from '@vue/language-core';
import { ServiceEnvironment, convertAttrName, convertTagName, createVueServicePlugins, detect } from '@vue/language-service';
import { DetectNameCasingRequest, GetConvertAttrCasingEditsRequest, GetConvertTagCasingEditsRequest, ParseSFCRequest } from './lib/protocol';
import type { VueInitializationOptions } from './lib/types';
import * as tsPluginClient from '@vue/typescript-plugin/lib/client';
import { GetConnectedNamedPipeServerRequest } from './lib/protocol';

export const connection: Connection = createConnection();

export const server = createServer(connection);

const envToVueOptions = new WeakMap<ServiceEnvironment, VueCompilerOptions>();

let tsdk: ReturnType<typeof loadTsdkByPath>;

connection.listen();

connection.onInitialize(async params => {

	const options: VueInitializationOptions = params.initializationOptions;

	tsdk = loadTsdkByPath(options.typescript.tsdk!, params.locale);

	const vueFileExtensions: string[] = ['vue'];

	if (options.vue?.additionalExtensions) {
		for (const additionalExtension of options.vue.additionalExtensions) {
			vueFileExtensions.push(additionalExtension);
		}
	}

	const result = await server.initialize(
		params,
		createSimpleProjectProviderFactory(),
		{
			watchFileExtensions: ['js', 'cjs', 'mjs', 'ts', 'cts', 'mts', 'jsx', 'tsx', 'json', ...vueFileExtensions],
			getServicePlugins() {
				return createVueServicePlugins(tsdk.typescript, env => envToVueOptions.get(env)!, tsPluginClient);
			},
			async getLanguagePlugins(serviceEnv, projectContext) {
				const [commandLine, vueOptions] = await parseCommandLine();
				const resolvedVueOptions = resolveVueCompilerOptions(vueOptions);
				const vueLanguagePlugin = createVueLanguagePlugin(
					tsdk.typescript,
					serviceEnv.typescript!.uriToFileName,
					fileName => {
						if (projectContext.typescript?.sys.useCaseSensitiveFileNames ?? false) {
							return projectContext.typescript?.host.getScriptFileNames().includes(fileName) ?? false;
						}
						else {
							const lowerFileName = fileName.toLowerCase();
							for (const rootFile of projectContext.typescript?.host.getScriptFileNames() ?? []) {
								if (rootFile.toLowerCase() === lowerFileName) {
									return true;
								}
							}
							return false;
						}
					},
					commandLine?.options ?? {},
					resolvedVueOptions,
					options.codegenStack,
				);

				envToVueOptions.set(serviceEnv, resolvedVueOptions);

				return [vueLanguagePlugin];

				async function parseCommandLine() {

					let commandLine: ParsedCommandLine | undefined;
					let vueOptions: Partial<VueCompilerOptions> = {};

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

					if (commandLine) {
						vueOptions = commandLine.vueOptions;
					}
					vueOptions.extensions = [
						...vueOptions.extensions ?? ['.vue'],
						...vueFileExtensions.map(ext => '.' + ext),
					];
					vueOptions.extensions = [...new Set(vueOptions.extensions)];

					return [commandLine, vueOptions] as const;
				}
			},
		},
	);

	// handle by tsserver + @vue/typescript-plugin
	result.capabilities.semanticTokensProvider = undefined;

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
		return await detect(languageService.context, params.textDocument.uri, tsPluginClient);
	}
});

connection.onRequest(GetConvertTagCasingEditsRequest.type, async params => {
	const languageService = await getService(params.textDocument.uri);
	if (languageService) {
		return await convertTagName(languageService.context, params.textDocument.uri, params.casing, tsPluginClient);
	}
});

connection.onRequest(GetConvertAttrCasingEditsRequest.type, async params => {
	const languageService = await getService(params.textDocument.uri);
	if (languageService) {
		return await convertAttrName(languageService.context, params.textDocument.uri, params.casing, tsPluginClient);
	}
});

connection.onRequest(GetConnectedNamedPipeServerRequest.type, async fileName => {
	const server = await tsPluginClient.searchNamedPipeServerForFile(fileName);
	if (server) {
		return server;
	}
});

async function getService(uri: string) {
	return (await server.projects.getProject(uri)).getLanguageService();
}
