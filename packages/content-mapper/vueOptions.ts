import * as vue from '@vue/language-core';
import * as path from 'node:path';
import type { MapperOptions } from './protocol';

/** Resolves one mapper entry from its own `options` alone. */
export function resolveMapperOptions(
	readFile: (fileName: string) => string | undefined,
	configFileName: string | undefined,
	options: MapperOptions | undefined,
) {
	const rootDir = configFileName ? path.dirname(configFileName) : process.cwd();
	const { languageFeatures, ...rawVueOptions } = options ?? {};
	const pluginFiles: string[] = [];
	const pluginErrors: vue.VuePluginError[] = [];
	return {
		languageFeatures: languageFeatures !== false,
		vueOptions: vue.resolveVueCompilerOptions(
			readFile,
			normalizePath(rootDir),
			rawVueOptions as vue.RawVueCompilerOptions,
			pluginFiles,
			pluginErrors,
		),
		pluginFiles,
		pluginErrors,
	};
}

function normalizePath(fileName: string) {
	return fileName.replace(/\\/g, '/');
}
