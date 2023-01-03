import { languageModule as svelteLanguageModule } from '@volar-examples/svelte-language-core';
import useTsPlugin from '@volar-plugins/typescript';
import { createLanguageServer, LanguageServerInitializationOptions, LanguageServerPlugin } from '@volar/language-server/node';
import * as vue from '@volar/vue-language-core';

const plugin: LanguageServerPlugin<LanguageServerInitializationOptions, vue.LanguageServiceHost> = () => {
	return {
		extraFileExtensions: [
			{ extension: 'vue', isMixedContent: true, scriptKind: 7 },
			{ extension: 'svelte', isMixedContent: true, scriptKind: 7 },
		],
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
			let plugins = [svelteLanguageModule];

			const ts = host.getTypeScriptModule();
			if (ts) {
				plugins = [
					...plugins,
					...vue.createLanguageModules(
						ts,
						host.getCompilationSettings(),
						host.getVueCompilationSettings(),
					),
				];
			}

			return plugins;
		},
		getServicePlugins() {
			return [
				useTsPlugin(),
			];
		},
	};
};

createLanguageServer([plugin]);
