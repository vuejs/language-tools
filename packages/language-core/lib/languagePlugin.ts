import type { LanguagePlugin } from '@volar/language-core';
import * as CompilerDOM from '@vue/compiler-dom';
import * as LanguageCore from '../index';
import { createEmbeddedCodePlugins, createPlugins, sortPlugins } from './plugins';
import type { TypeScript, VueCompilerOptions, VueLanguagePlugin } from './types';
import { getRootLanguageId, VueVirtualCode } from './virtualCode';

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

/** The built-in embedded-code plugins, as instances in their order; only the language service reads them. */
export function createVueEmbeddedCodePlugins(ts: TypeScript, vueCompilerOptions: VueCompilerOptions) {
	return createEmbeddedCodePlugins(createPluginContext(ts, vueCompilerOptions));
}

export function createVueLanguagePlugin<T>(
	ts: TypeScript,
	vueCompilerOptions: VueCompilerOptions,
	asFileName: (scriptId: T) => string,
): LanguagePlugin<T, VueVirtualCode> {
	const plugins = createVuePlugins(ts, vueCompilerOptions);
	// The plugins of `vueCompilerOptions.plugins` may contribute embedded codes too.
	const embeddedCodePlugins = sortPlugins([...createVueEmbeddedCodePlugins(ts, vueCompilerOptions), ...plugins]);

	return {
		// Every file passed in is parsed by `vueCompilerOptions.format`; the host routes to this plugin only the
		// files of the `contentMappers` entry it was created for.
		getLanguageId() {
			return getRootLanguageId(vueCompilerOptions);
		},
		createVirtualCode(scriptId, _languageId, snapshot) {
			return new VueVirtualCode(asFileName(scriptId), snapshot, vueCompilerOptions, plugins, embeddedCodePlugins, ts);
		},
		updateVirtualCode(_scriptId, code, snapshot) {
			code.update(snapshot);
			return code;
		},
	};
}
