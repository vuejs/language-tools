import { createConnection, createServer, loadTsdkByPath } from '@volar/language-server/node';
import { createVueLanguagePlugin, getDefaultCompilerOptions } from '@vue/language-core';
import { getHybridModeLanguageServicePlugins } from '@vue/language-service';
import { createHybridModeProject } from './lib/hybridModeProject';
import type { VueInitializationOptions } from './lib/types';

const connection = createConnection();
const server = createServer(connection);

connection.listen();

connection.onInitialize(params => {
	const options: VueInitializationOptions = params.initializationOptions;

	if (!options.typescript?.tsdk) {
		throw new Error('typescript.tsdk is required');
	}
	if (!options.typescript?.requestForwardingCommand) {
		connection.console.warn('typescript.requestForwardingCommand is required since >= 3.0 for complete TS features');
	}

	const { typescript: ts } = loadTsdkByPath(options.typescript.tsdk, params.locale);
	return server.initialize(
		params,
		createHybridModeProject(
			() => {
				const commandLine = {
					vueOptions: getDefaultCompilerOptions(),
					options: ts.getDefaultCompilerOptions(),
				};
				return {
					languagePlugins: [
						createVueLanguagePlugin(
							ts,
							commandLine.options,
							commandLine.vueOptions,
							uri => uri.fsPath.replace(/\\/g, '/')
						),
					],
					setup({ project }) {
						project.vue = { compilerOptions: commandLine.vueOptions };
					},
				};
			}
		),
		getHybridModeLanguageServicePlugins(ts, options.typescript.requestForwardingCommand ? {
			collectExtractProps(...args) {
				return connection.sendRequest(options.typescript.requestForwardingCommand!, ['vue:collectExtractProps', args]);
			},
			getComponentDirectives(...args) {
				return connection.sendRequest(options.typescript.requestForwardingCommand!, ['vue:getComponentDirectives', args]);
			},
			getComponentEvents(...args) {
				return connection.sendRequest(options.typescript.requestForwardingCommand!, ['vue:getComponentEvents', args]);
			},
			getComponentNames(...args) {
				return connection.sendRequest(options.typescript.requestForwardingCommand!, ['vue:getComponentNames', args]);
			},
			getComponentProps(...args) {
				return connection.sendRequest(options.typescript.requestForwardingCommand!, ['vue:getComponentProps', args]);
			},
			getElementAttrs(...args) {
				return connection.sendRequest(options.typescript.requestForwardingCommand!, ['vue:getElementAttrs', args]);
			},
			getElementNames(...args) {
				return connection.sendRequest(options.typescript.requestForwardingCommand!, ['vue:getElementNames', args]);
			},
			getImportPathForFile(...args) {
				return connection.sendRequest(options.typescript.requestForwardingCommand!, ['vue:getImportPathForFile', args]);
			},
			getPropertiesAtLocation(...args) {
				return connection.sendRequest(options.typescript.requestForwardingCommand!, ['vue:getPropertiesAtLocation', args]);
			},
			getQuickInfoAtPosition(...args) {
				return connection.sendRequest(options.typescript.requestForwardingCommand!, ['vue:getQuickInfoAtPosition', args]);
			},
		} : undefined)
	);
});

connection.onInitialized(server.initialized);

connection.onShutdown(server.shutdown);
