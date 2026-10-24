import * as vue from '@vue/language-core';
import * as path from 'node:path';
import type { MapperOptions } from './protocol';

/**
 * Resolves one mapper entry from its own `options` alone. The language server calls this too, so
 * both produce the same virtual code.
 */
export function resolveMapperOptions(
	readFile: (fileName: string) => string | undefined,
	configFileName: string | undefined,
	options: MapperOptions | undefined,
) {
	const rootDir = configFileName ? path.dirname(configFileName) : process.cwd();
	const { languageFeatures, ...rawVueOptions } = options ?? {};
	const resolver = new vue.CompilerOptionsResolver(readFile);
	resolver.addConfig(rawVueOptions as vue.RawVueCompilerOptions, normalizePath(rootDir));
	const vueOptions = resolver.build();
	if (vueOptions.format === 'petite-vue') {
		vueOptions.globalTemplateContext = true;
	}
	return {
		rootDir,
		languageFeatures: languageFeatures !== false,
		plugins: rawVueOptions.plugins,
		vueOptions,
	};
}

function normalizePath(fileName: string) {
	return fileName.replace(/\\/g, '/');
}
