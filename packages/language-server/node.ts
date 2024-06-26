import { createConnection, createServer, createTypeScriptProject, loadTsdkByPath } from '@volar/language-server/node';
import { FileMap, VueCompilerOptions, createParsedCommandLine, createVueLanguagePlugin, resolveVueCompilerOptions } from '@vue/language-core';
import { Disposable, getFullLanguageServicePlugins, getHybridModeLanguageServicePlugins } from '@vue/language-service';
import * as tsPluginClient from '@vue/typescript-plugin/lib/client';
import type * as ts from 'typescript';
import { createHybridModeProject } from './lib/hybridModeProject';
import type { VueInitializationOptions } from './lib/types';

const connection = createConnection();
const server = createServer(connection);

connection.listen();

connection.onInitialize(params => {
	const options: VueInitializationOptions = params.initializationOptions;
	const tsdk = loadTsdkByPath(options.typescript.tsdk, params.locale);
	const watchingExtensions = new Set<string>();

	let fileWatcher: Promise<Disposable> | undefined;

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
					const vueLanguagePlugin = createVueLanguagePlugin(
						tsdk.typescript,
						asFileName,
						() => '',
						() => false,
						commandLine.options,
						commandLine.vueOptions
					);
					return {
						languagePlugins: [vueLanguagePlugin],
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
		server.initialize(
			params,
			createTypeScriptProject(
				tsdk.typescript,
				tsdk.diagnosticMessages,
				async ({ configFileName, sys, projectHost, asFileName }) => {
					const vueCompilerOptions = configFileName
						? await getVueCompilerOptions(sys, configFileName)
						: resolveVueCompilerOptions({});
					const vueLanguagePlugin = createVueLanguagePlugin(
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
					);
					updateFileWatcher(vueCompilerOptions);
					return {
						languagePlugins: [vueLanguagePlugin],
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
	}

	return server.initializeResult;

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

	async function getVueCompilerOptions(
		sys: ts.ParseConfigHost & ({} | {
			version: number;
			sync(): Promise<number>;
		}),
		configFileName: string
	) {
		let commandLine = createParsedCommandLine(tsdk.typescript, sys, configFileName);
		if (sys && 'sync' in sys) {
			let sysVersion = sys.version;
			let newSysVersion = await sys.sync();
			while (sysVersion !== newSysVersion) {
				commandLine = createParsedCommandLine(tsdk.typescript, sys, configFileName);
				sysVersion = newSysVersion;
				newSysVersion = await sys.sync();
			}
		}
		return commandLine.vueOptions;
	}
});

connection.onInitialized(server.initialized);

connection.onShutdown(server.shutdown);
