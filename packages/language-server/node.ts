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
		getHybridModeLanguageServicePlugins(ts, {
			collectExtractProps(...args) {
				return connection.sendRequest(options.typescript.requestForwardingCommand, ['vue:collectExtractProps', args]);
			},
			getComponentDirectives(...args) {
				return connection.sendRequest(options.typescript.requestForwardingCommand, ['vue:getComponentDirectives', args]);
			},
			getComponentEvents(...args) {
				return connection.sendRequest(options.typescript.requestForwardingCommand, ['vue:getComponentEvents', args]);
			},
			getComponentNames(...args) {
				return connection.sendRequest(options.typescript.requestForwardingCommand, ['vue:getComponentNames', args]);
			},
			getComponentProps(...args) {
				return connection.sendRequest(options.typescript.requestForwardingCommand, ['vue:getComponentProps', args]);
			},
			getElementAttrs(...args) {
				return connection.sendRequest(options.typescript.requestForwardingCommand, ['vue:getElementAttrs', args]);
			},
			getImportPathForFile(...args) {
				return connection.sendRequest(options.typescript.requestForwardingCommand, ['vue:getImportPathForFile', args]);
			},
			getPropertiesAtLocation(...args) {
				return connection.sendRequest(options.typescript.requestForwardingCommand, ['vue:getPropertiesAtLocation', args]);
			},
			getQuickInfoAtPosition(...args) {
				return connection.sendRequest(options.typescript.requestForwardingCommand, ['vue:getQuickInfoAtPosition', args]);
			},
		})
	);
});

connection.onInitialized(server.initialized);

connection.onShutdown(server.shutdown);
