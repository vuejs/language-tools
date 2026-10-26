import * as vue from '@vue/language-core';
import * as path from 'node:path';
import type { MapperOptions } from '../protocol';

/** The directory a project's options and TS 7.1 resolve from. */
export function getProjectDirectory(configFileName: string | undefined) {
	return configFileName ? path.dirname(configFileName) : process.cwd();
}

/** Resolves one mapper entry from its own `options` alone. */
export function resolveMapperOptions(
	readFile: (fileName: string) => string | undefined,
	configFileName: string | undefined,
	options: MapperOptions | undefined,
) {
	const { languageFeatures, ...rawVueOptions } = options ?? {};
	const pluginFiles: string[] = [];
	const pluginErrors: vue.VuePluginError[] = [];
	return {
		languageFeatures: languageFeatures !== false,
		vueOptions: vue.resolveVueCompilerOptions(
			readFile,
			normalizePath(getProjectDirectory(configFileName)),
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
