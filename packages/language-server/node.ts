import { createConnection, createServer, loadTsdkByPath } from '@volar/language-server/node';
import { createParsedCommandLine, createVueLanguagePlugin, getDefaultCompilerOptions } from '@vue/language-core';
import { getHybridModeLanguageServicePlugins } from '@vue/language-service';
import * as namedPipeClient from '@vue/typescript-plugin/lib/client';
import { createHybridModeProject } from './lib/hybridModeProject';
import type { VueInitializationOptions } from './lib/types';

const connection = createConnection();
const server = createServer(connection);

connection.listen();

connection.onInitialize(params => {
	const options: VueInitializationOptions = params.initializationOptions;
	const { typescript: ts } = loadTsdkByPath(options.typescript.tsdk, params.locale);
	return server.initialize(
		params,
		createHybridModeProject(
			({ asFileName, configFileName }) => {
				const commandLine = configFileName
					? createParsedCommandLine(ts, ts.sys, configFileName)
					: {
						vueOptions: getDefaultCompilerOptions(),
						options: ts.getDefaultCompilerOptions(),
					};
				commandLine.vueOptions.__test = params.initializationOptions.typescript.disableAutoImportCache;
				return {
					languagePlugins: [
						createVueLanguagePlugin(
							ts,
							commandLine.options,
							commandLine.vueOptions,
							asFileName
						),
					],
					setup({ project }) {
						project.vue = { compilerOptions: commandLine.vueOptions };
					},
				};
			}
		),
		getHybridModeLanguageServicePlugins(ts, namedPipeClient)
	);
});

connection.onInitialized(server.initialized);

connection.onShutdown(server.shutdown);
