import type { LanguageServer } from '@volar/language-server';
import { createTypeScriptProject } from '@volar/language-server/node';
import { createParsedCommandLine, createRootFileChecker, createVueLanguagePlugin2, getAllExtensions, resolveVueCompilerOptions, VueCompilerOptions } from '@vue/language-core';
import { Disposable, getFullLanguageServicePlugins, InitializeParams } from '@vue/language-service';
import type * as ts from 'typescript';

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
			async ({ configFileName, sys, projectHost, uriConverter }) => {
				let compilerOptions: ts.CompilerOptions;
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
					compilerOptions = commandLine.options;
					vueCompilerOptions = commandLine.vueOptions;
				}
				else {
					compilerOptions = ts.getDefaultCompilerOptions();
					vueCompilerOptions = resolveVueCompilerOptions({});
				}
				updateFileWatcher(vueCompilerOptions);
				return {
					languagePlugins: [createVueLanguagePlugin2(
						ts,
						s => uriConverter.asFileName(s),
						createRootFileChecker(
							projectHost.getProjectVersion ? () => projectHost.getProjectVersion!() : undefined,
							() => projectHost.getScriptFileNames(),
							sys.useCaseSensitiveFileNames
						),
						compilerOptions,
						vueCompilerOptions
					)],
					setup({ project }) {
						project.vue = { compilerOptions: vueCompilerOptions };
					},
				};
			}
		),
		getFullLanguageServicePlugins(ts, { disableAutoImportCache: params.initializationOptions.typescript.disableAutoImportCache })
	);

	function updateFileWatcher(vueCompilerOptions: VueCompilerOptions) {
		const extensions = [
			'js', 'cjs', 'mjs', 'ts', 'cts', 'mts', 'jsx', 'tsx', 'json',
			...getAllExtensions(vueCompilerOptions).map(ext => ext.slice(1)),
		];
		const newExtensions = extensions.filter(ext => !watchingExtensions.has(ext));
		if (newExtensions.length) {
			for (const ext of newExtensions) {
				watchingExtensions.add(ext);
			}
			fileWatcher?.then(dispose => dispose.dispose());
			fileWatcher = server.fileWatcher.watchFiles(['**/*.{' + [...watchingExtensions].join(',') + '}']);
		}
	}
}
