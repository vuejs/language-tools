import type { LanguagePlugin } from '@volar/language-core';
import * as CompilerDOM from '@vue/compiler-dom';
import * as LanguageCore from '../index';
import { createPlugins } from './plugins';
import type { TypeScript, VueCompilerOptions, VueLanguagePlugin } from './types';
import { getRootLanguageId, VueVirtualCode } from './virtualCode';

/** The built-in plugins and the ones of `vueCompilerOptions.plugins`, as instances in their order. */
export function createVuePlugins(ts: TypeScript, vueCompilerOptions: VueCompilerOptions) {
	const pluginContext: Parameters<VueLanguagePlugin>[0] = {
		modules: {
			'@vue/compiler-dom': CompilerDOM,
			'@vue/language-core': LanguageCore,
			typescript: ts,
		},
		vueCompilerOptions,
		config: {},
	};
	return createPlugins(pluginContext);
}

export function createVueLanguagePlugin<T>(
	ts: TypeScript,
	vueCompilerOptions: VueCompilerOptions,
	asFileName: (scriptId: T) => string,
): LanguagePlugin<T, VueVirtualCode> {
	const plugins = createVuePlugins(ts, vueCompilerOptions);

	return {
		// Every file passed in is parsed by `vueCompilerOptions.format`; the host routes to this plugin only the
		// files of the `contentMappers` entry it was created for.
		getLanguageId() {
			return getRootLanguageId(vueCompilerOptions);
		},
		createVirtualCode(scriptId, _languageId, snapshot) {
			return new VueVirtualCode(asFileName(scriptId), snapshot, vueCompilerOptions, plugins, ts);
		},
		updateVirtualCode(_scriptId, code, snapshot) {
			code.update(snapshot);
			return code;
		},
	};
}
