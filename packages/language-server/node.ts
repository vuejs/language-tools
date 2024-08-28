import { createConnection, createServer, loadTsdkByPath } from '@volar/language-server/node';
import { createParsedCommandLine, createVueLanguagePlugin, resolveVueCompilerOptions } from '@vue/language-core';
import { getHybridModeLanguageServicePlugins } from '@vue/language-service';
import * as namedPipeClient from '@vue/typescript-plugin/lib/client';
import { createHybridModeProject } from './lib/hybridModeProject';
import { initialize } from './lib/initialize';
import type { VueInitializationOptions } from './lib/types';

const connection = createConnection();
const server = createServer(connection);

connection.listen();

connection.onInitialize(params => {
	const options: VueInitializationOptions = params.initializationOptions;
	const { typescript: ts, diagnosticMessages } = loadTsdkByPath(options.typescript.tsdk, params.locale);
	const hybridMode = options.vue?.hybridMode ?? true;
	if (hybridMode) {
		return server.initialize(
			params,
			createHybridModeProject(
				({ asFileName, configFileName }) => {
					const commandLine = configFileName
						? createParsedCommandLine(ts, ts.sys, configFileName)
						: {
							vueOptions: resolveVueCompilerOptions({}),
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
	}
	else {
		return initialize(server, params, ts, diagnosticMessages);
	}
});

connection.onInitialized(server.initialized);

connection.onShutdown(server.shutdown);
