import { LanguageServer } from '@volar/language-server';
import { createTypeScriptProject } from '@volar/language-server/node';
import { createParsedCommandLine, createVueLanguagePlugin, FileMap, resolveVueCompilerOptions, VueCompilerOptions } from '@vue/language-core';
import { Disposable, getFullLanguageServicePlugins, getHybridModeLanguageServicePlugins, InitializeParams } from '@vue/language-service';
import * as namedPipeClient from '@vue/typescript-plugin/lib/client';
import type * as ts from 'typescript';
import { createHybridModeProject } from './hybridModeProject';

export function initialize(
	server: LanguageServer,
	params: InitializeParams,
	ts: typeof import('typescript'),
	tsLocalized: ts.MapLike<string> | undefined
) {
	const watchingExtensions = new Set<string>();
	let fileWatcher: Promise<Disposable> | undefined;

	return server.initialize(
		params,
		createTypeScriptProject(
			ts,
			tsLocalized,
			async ({ configFileName, sys, projectHost, asFileName }) => {
				let vueCompilerOptions: VueCompilerOptions;
				if (configFileName) {
					let commandLine = createParsedCommandLine(ts, sys, configFileName);
					let sysVersion = sys.version;
					let newSysVersion = await sys.sync();
					while (sysVersion !== newSysVersion) {
						commandLine = createParsedCommandLine(ts, sys, configFileName);
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
						ts,
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
		getFullLanguageServicePlugins(ts)
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

export function initializeHybridMode(
	server: LanguageServer,
	params: InitializeParams,
	ts: typeof import('typescript')
) {
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
				return {
					languagePlugins: [createVueLanguagePlugin(
						ts,
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
		getHybridModeLanguageServicePlugins(ts, namedPipeClient),
		{ pullModelDiagnostics: true }
	);
}
