/// <reference types="@volar/typescript" />

import { forEachEmbeddedCode, LanguagePlugin } from '@volar/language-core';
import * as CompilerDOM from '@vue/compiler-dom';
import type * as ts from 'typescript';
import { createPlugins } from './plugins';
import type { VueCompilerOptions, VueLanguagePlugin, VueLanguagePluginReturn } from './types';
import * as CompilerVue2 from './utils/vue2TemplateCompiler';
import { VueVirtualCode } from './virtualFile/vueFile';

const fileRegistries: {
	key: string;
	plugins: VueLanguagePlugin[];
	files: Map<string, VueVirtualCode>;
}[] = [];

function getVueFileRegistry(key: string, plugins: VueLanguagePlugin[]) {
	let fileRegistry = fileRegistries.find(r =>
		r.key === key
		&& r.plugins.length === plugins.length
		&& r.plugins.every(plugin => plugins.includes(plugin))
	)?.files;
	if (!fileRegistry) {
		fileRegistry = new Map();
		fileRegistries.push({
			key: key,
			plugins: plugins,
			files: fileRegistry,
		});
	}
	return fileRegistry;
}

function getFileRegistryKey(
	compilerOptions: ts.CompilerOptions,
	vueCompilerOptions: VueCompilerOptions,
	plugins: VueLanguagePluginReturn[]
) {
	const values = [
		...Object.keys(vueCompilerOptions)
			.sort()
			.filter(key => key !== 'plugins')
			.map(key => [key, vueCompilerOptions[key as keyof VueCompilerOptions]]),
		[...new Set(plugins.map(plugin => plugin.requiredCompilerOptions ?? []).flat())]
			.sort()
			.map(key => [key, compilerOptions[key as keyof ts.CompilerOptions]]),
	];
	return JSON.stringify(values);
}

export function createVueLanguagePlugin<T>(
	ts: typeof import('typescript'),
	compilerOptions: ts.CompilerOptions,
	vueCompilerOptions: VueCompilerOptions,
	asFileName: (scriptId: T) => string
): LanguagePlugin<T, VueVirtualCode> {
	const pluginContext: Parameters<VueLanguagePlugin>[0] = {
		modules: {
			'@vue/compiler-dom': vueCompilerOptions.target < 3
				? {
					...CompilerDOM,
					compile: CompilerVue2.compile,
				}
				: CompilerDOM,
			typescript: ts,
		},
		compilerOptions,
		vueCompilerOptions,
	};
	const plugins = createPlugins(pluginContext);
	const fileRegistry = getVueFileRegistry(
		getFileRegistryKey(compilerOptions, vueCompilerOptions, plugins),
		vueCompilerOptions.plugins
	);

	return {
		getLanguageId(scriptId) {
			const fileName = asFileName(scriptId);
			for (const plugin of plugins) {
				const languageId = plugin.getLanguageId?.(fileName);
				if (languageId) {
					return languageId;
				}
			}
		},
		createVirtualCode(scriptId, languageId, snapshot) {
			const fileName = asFileName(scriptId);
			if (plugins.some(plugin => plugin.isValidFile?.(fileName, languageId))) {
				const code = fileRegistry.get(fileName);
				if (code) {
					code.update(snapshot);
					return code;
				}
				else {
					const code = new VueVirtualCode(
						fileName,
						languageId,
						snapshot,
						vueCompilerOptions,
						plugins,
						ts,
					);
					fileRegistry.set(fileName, code);
					return code;
				}
			}
		},
		updateVirtualCode(_fileId, code, snapshot) {
			code.update(snapshot);
			return code;
		},
		typescript: {
			extraFileExtensions: getAllExtensions(vueCompilerOptions)
				.map<ts.FileExtensionInfo>(ext => ({
					extension: ext.slice(1),
					isMixedContent: true,
					scriptKind: 7 satisfies ts.ScriptKind.Deferred,
				})),
			getServiceScript(root) {
				for (const code of forEachEmbeddedCode(root)) {
					if (/script_(js|jsx|ts|tsx)/.test(code.id)) {
						const lang = code.id.substring('script_'.length);
						return {
							code,
							extension: '.' + lang,
							scriptKind: lang === 'js' ? ts.ScriptKind.JS
								: lang === 'jsx' ? ts.ScriptKind.JSX
									: lang === 'tsx' ? ts.ScriptKind.TSX
										: ts.ScriptKind.TS,
						};
					}
				}
			},
		},
	};
}

export function getAllExtensions(options: VueCompilerOptions) {
	const result = new Set<string>();
	for (const key in options) {
		if (key === 'extensions' || key.endsWith('Extensions')) {
			const value = options[key as keyof VueCompilerOptions];
			if (Array.isArray(value) && value.every(v => typeof v === 'string')) {
				for (const ext of value) {
					result.add(ext);
				}
			}
		}
	}
	return [...result];
}
