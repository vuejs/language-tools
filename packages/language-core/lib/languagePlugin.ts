/// <reference types="@volar/typescript" />

import { forEachEmbeddedCode, type LanguagePlugin } from '@volar/language-core';
import * as CompilerDOM from '@vue/compiler-dom';
import * as LanguageCore from '../index';
import { createPlugins } from './plugins';
import { serviceScriptRE } from './plugins/vue-tsx';
import type { VueCompilerOptions, VueLanguagePlugin, VueLanguagePluginReturn } from './types';
import { getRootLanguageId, VueVirtualCode } from './virtualCode';

const fileRegistries: Record<string, Map<string, VueVirtualCode>> = {};

function getVueFileRegistry(vueCompilerOptions: VueCompilerOptions, plugins: VueLanguagePluginReturn[]) {
	const key = JSON.stringify([
		...plugins.map(plugin => plugin.name)
			.filter(name => typeof name === 'string')
			.sort(),
		...Object.keys(vueCompilerOptions)
			.filter(key => key !== 'plugins')
			.sort()
			.map(key => [key, vueCompilerOptions[key as keyof VueCompilerOptions]]),
	]);

	return fileRegistries[key] ??= new Map();
}

export function createVueLanguagePlugin<T>(
	ts: typeof import('typescript'),
	vueCompilerOptions: VueCompilerOptions,
	asFileName: (scriptId: T) => string,
): LanguagePlugin<T, VueVirtualCode> {
	const pluginContext: Parameters<VueLanguagePlugin>[0] = {
		modules: {
			'@vue/compiler-dom': CompilerDOM,
			'@vue/language-core': LanguageCore,
			typescript: ts,
		},
		vueCompilerOptions,
		config: {},
	};
	const plugins = createPlugins(pluginContext);
	const fileRegistry = getVueFileRegistry(vueCompilerOptions, plugins);

	return {
		// Every file passed in is parsed by `vueCompilerOptions.format`; the host routes to this plugin only the
		// files of the `contentMappers` entry it was created for.
		getLanguageId() {
			return getRootLanguageId(vueCompilerOptions);
		},
		createVirtualCode(scriptId, _languageId, snapshot) {
			let code = fileRegistry.get(String(scriptId));
			if (code) {
				code.update(snapshot);
			}
			else {
				code = new VueVirtualCode(asFileName(scriptId), snapshot, vueCompilerOptions, plugins, ts);
				fileRegistry.set(String(scriptId), code);
			}
			return code;
		},
		updateVirtualCode(_scriptId, code, snapshot) {
			code.update(snapshot);
			return code;
		},
		disposeVirtualCode(scriptId) {
			fileRegistry.delete(String(scriptId));
		},
		typescript: {
			// A TypeScript host registers the extensions of the files it routes to this plugin.
			extraFileExtensions: [],
			getServiceScript(root) {
				for (const code of forEachEmbeddedCode(root)) {
					if (serviceScriptRE.test(code.id)) {
						const lang = code.id.slice('script_'.length);
						return {
							code,
							extension: '.' + lang,
							scriptKind: lang === 'js'
								? ts.ScriptKind.JS
								: lang === 'jsx'
								? ts.ScriptKind.JSX
								: lang === 'tsx'
								? ts.ScriptKind.TSX
								: ts.ScriptKind.TS,
						};
					}
				}
			},
		},
	};
}
