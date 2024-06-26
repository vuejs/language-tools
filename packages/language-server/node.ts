import { createConnection, createServer, createTypeScriptProject, loadTsdkByPath } from '@volar/language-server/node';
import { FileMap, VueCompilerOptions, createParsedCommandLine, createVueLanguagePlugin, resolveVueCompilerOptions } from '@vue/language-core';
import { Disposable, getFullLanguageServicePlugins, getHybridModeLanguageServicePlugins } from '@vue/language-service';
import * as tsPluginClient from '@vue/typescript-plugin/lib/client';
import { createHybridModeProject } from './lib/hybridModeProject';
import type { VueInitializationOptions } from './lib/types';

const connection = createConnection();
const server = createServer(connection);

connection.listen();

connection.onInitialize(params => {
	const options: VueInitializationOptions = params.initializationOptions;
	const tsdk = loadTsdkByPath(options.typescript.tsdk, params.locale);

	if (options.vue?.hybridMode) {
		server.initialize(
			params,
			createHybridModeProject(
				({ asFileName, configFileName }) => {
					const commandLine = configFileName
						? createParsedCommandLine(tsdk.typescript, tsdk.typescript.sys, configFileName)
						: {
							vueOptions: resolveVueCompilerOptions({}),
							options: tsdk.typescript.getDefaultCompilerOptions(),
						};
					return {
						languagePlugins: [createVueLanguagePlugin(
							tsdk.typescript,
							asFileName,
							() => '',
							() => false,
							commandLine.options,
							commandLine.vueOptions
						)],
						setup(language) {
							language.vue = {
								compilerOptions: commandLine.vueOptions,
							};
						},
					};
				}
			),
			getHybridModeLanguageServicePlugins(
				tsdk.typescript,
				tsPluginClient
			)
		);
	}
	else {
		const watchingExtensions = new Set<string>();
		let fileWatcher: Promise<Disposable> | undefined;

		server.initialize(
			params,
			createTypeScriptProject(
				tsdk.typescript,
				tsdk.diagnosticMessages,
				async ({ configFileName, sys, projectHost, asFileName }) => {
					let vueCompilerOptions: VueCompilerOptions;
					if (configFileName) {
						let commandLine = createParsedCommandLine(tsdk.typescript, sys, configFileName);
						let sysVersion = sys.version;
						let newSysVersion = await sys.sync();
						while (sysVersion !== newSysVersion) {
							commandLine = createParsedCommandLine(tsdk.typescript, sys, configFileName);
							sysVersion = newSysVersion;
							newSysVersion = await sys.sync();
						}
						vueCompilerOptions = commandLine.vueOptions;
					}
					else {
						vueCompilerOptions = resolveVueCompilerOptions({});
					}
					updateFileWatcher(vueCompilerOptions);
					return {
						languagePlugins: [createVueLanguagePlugin(
							tsdk.typescript,
							asFileName,
							() => projectHost?.getProjectVersion?.() ?? '',
							fileName => {
								const fileMap = new FileMap(sys?.useCaseSensitiveFileNames ?? false);
								for (const vueFileName of projectHost?.getScriptFileNames() ?? []) {
									fileMap.set(vueFileName, undefined);
								}
								return fileMap.has(fileName);
							},
							projectHost.getCompilationSettings(),
							vueCompilerOptions
						)],
						setup(language) {
							language.vue = {
								compilerOptions: vueCompilerOptions,
							};
						},
					};
				}
			),
			getFullLanguageServicePlugins(tsdk.typescript)
		);

		function updateFileWatcher(vueCompilerOptions: VueCompilerOptions) {
			const extensions = [
				'js', 'cjs', 'mjs', 'ts', 'cts', 'mts', 'jsx', 'tsx', 'json',
				...vueCompilerOptions.extensions.map(ext => ext.slice(1)),
				...vueCompilerOptions.vitePressExtensions.map(ext => ext.slice(1)),
				...vueCompilerOptions.petiteVueExtensions.map(ext => ext.slice(1)),
			];
			const newExtensions = extensions.filter(ext => !watchingExtensions.has(ext));
			if (newExtensions.length) {
				for (const ext of newExtensions) {
					watchingExtensions.add(ext);
				}
				fileWatcher?.then(dispose => dispose.dispose());
				fileWatcher = server.watchFiles(['**/*.{' + [...watchingExtensions].join(',') + '}']);
			}
		}
	}

	return server.initializeResult;
});

connection.onInitialized(server.initialized);

connection.onShutdown(server.shutdown);
