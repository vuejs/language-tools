import * as CompilerDOM from '@vue/compiler-dom';
import * as LanguageCore from '../index';
import { createPlugins } from './plugins';
import type { TypeScript, VueCompilerOptions, VueLanguagePlugin } from './types';

function createPluginContext(ts: TypeScript, vueCompilerOptions: VueCompilerOptions): Parameters<VueLanguagePlugin>[0] {
	return {
		modules: {
			'@vue/compiler-dom': CompilerDOM,
			'@vue/language-core': LanguageCore,
			typescript: ts,
		},
		vueCompilerOptions,
		config: {},
	};
}

/** The built-in IR plugins and the ones of `vueCompilerOptions.plugins`, as instances in their order. */
export function createVuePlugins(ts: TypeScript, vueCompilerOptions: VueCompilerOptions) {
	return createPlugins(createPluginContext(ts, vueCompilerOptions));
}
