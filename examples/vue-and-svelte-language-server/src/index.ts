import { languageModule as svelteLanguageModule } from '@volar-examples/svelte-language-core';
import useTsPlugin from '@volar-plugins/typescript';
import { createLanguageServer, LanguageModule, LanguageServerInitializationOptions, LanguageServerPlugin } from '@volar/language-server/node';
import * as shared from '@volar/shared';
import * as vue from '@volar/vue-language-core';

const plugin: LanguageServerPlugin<LanguageServerInitializationOptions, vue.LanguageServiceHost> = () => {
	return {
		extraFileExtensions: [
			{ extension: 'vue', isMixedContent: true, scriptKind: 7 },
			{ extension: 'svelte', isMixedContent: true, scriptKind: 7 },
		],
		semanticService: {
			resolveLanguageServiceHost(ts, sys, tsConfig, host) {
				let vueOptions: vue.VueCompilerOptions = {};
				if (typeof tsConfig === 'string') {
					vueOptions = vue.createParsedCommandLine(ts, sys, tsConfig, []).vueOptions;
				}
				return {
					...host,
					getVueCompilationSettings: () => vueOptions,
				};
			},
			getLanguageModules(host) {
				const vueLanguageModule = vue.createLanguageModule(
					host.getTypeScriptModule(),
					host.getCurrentDirectory(),
					host.getCompilationSettings(),
					host.getVueCompilationSettings(),
				);
				return [
					vueLanguageModule,
					svelteLanguageModule,
				];
			},
			getServicePlugins() {
				return [
					useTsPlugin(),
				];
			},
		},
		syntacticService: {
			getLanguageModules(ts, env) {
				const vueLanguagePlugins = vue.getDefaultVueLanguagePlugins(ts, shared.getPathOfUri(env.rootUri.toString()), {}, {}, []);
				const vueLanguageModule: LanguageModule = {
					createFile(fileName, snapshot) {
						if (fileName.endsWith('.vue')) {
							return new vue.VueFile(fileName, snapshot, ts, vueLanguagePlugins);
						}
					},
					updateFile(sourceFile: vue.VueFile, snapshot) {
						sourceFile.update(snapshot);
					},
				};
				return [
					vueLanguageModule,
					svelteLanguageModule,
				];
			},
			getServicePlugins() {
				return [
					useTsPlugin(),
				];
			}
		},
	};
};

createLanguageServer([plugin]);
