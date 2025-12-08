/// <reference types="@volar/typescript" />

import { forEachEmbeddedCode, type LanguagePlugin } from '@volar/language-core';
import * as CompilerDOM from '@vue/compiler-dom';
import type * as ts from 'typescript';
import { createPlugins } from './plugins';
import type { VueCompilerOptions, VueLanguagePlugin, VueLanguagePluginReturn } from './types';
import { VueVirtualCode } from './virtualCode';

const fileRegistries: Record<string, Map<string, VueVirtualCode>> = {};

function getVueFileRegistry(
	compilerOptions: ts.CompilerOptions,
	vueCompilerOptions: VueCompilerOptions,
	plugins: VueLanguagePluginReturn[],
) {
	const key = JSON.stringify([
		...plugins.map(plugin => plugin.name)
			.filter(name => typeof name === 'string')
			.sort(),
		...Object.keys(vueCompilerOptions)
			.filter(key => key !== 'plugins')
			.sort()
			.map(key => [key, vueCompilerOptions[key as keyof VueCompilerOptions]]),
		...[...new Set(plugins.flatMap(plugin => plugin.requiredCompilerOptions ?? []))]
			.sort()
			.map(key => [key, compilerOptions[key as keyof ts.CompilerOptions]]),
	]);

	return fileRegistries[key] ??= new Map();
}

export function createVueLanguagePlugin<T>(
	ts: typeof import('typescript'),
	compilerOptions: ts.CompilerOptions,
	vueCompilerOptions: VueCompilerOptions,
	asFileName: (scriptId: T) => string,
): LanguagePlugin<T, VueVirtualCode> {
	const pluginContext: Parameters<VueLanguagePlugin>[0] = {
		modules: {
			'@vue/compiler-dom': CompilerDOM,
			typescript: ts,
		},
		compilerOptions,
		vueCompilerOptions,
	};
	const plugins = createPlugins(pluginContext);
	const fileRegistry = getVueFileRegistry(compilerOptions, vueCompilerOptions, plugins);

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
				const code = fileRegistry.get(String(scriptId));
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
					fileRegistry.set(String(scriptId), code);
					return code;
				}
			}
		},
		updateVirtualCode(_scriptId, code, snapshot) {
			code.update(snapshot);
			return code;
		},
		disposeVirtualCode(scriptId) {
			fileRegistry.delete(String(scriptId));
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

export function getAllExtensions(options: VueCompilerOptions) {
	return [
		...new Set(([
			'extensions',
			'vitePressExtensions',
			'petiteVueExtensions',
		] as const).flatMap(key => options[key])),
	];
}
