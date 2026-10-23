import * as vue from '@vue/language-core';
import * as path from 'node:path';
import type { MapperOptions } from './protocol';

/**
 * Resolves the Vue compiler options of one mapper entry from its own `options` alone. The language
 * server calls this too, so both produce the same virtual code.
 */
export function resolveVueCompilerOptions(
	readFile: (fileName: string) => string | undefined,
	configFileName: string | undefined,
	options: MapperOptions | undefined,
) {
	const rootDir = normalizePath(configFileName ? path.dirname(configFileName) : process.cwd());
	const { languageFeatures, ...mapperOptions } = options ?? {};
	const resolver = new vue.CompilerOptionsResolver(readFile);
	resolver.addConfig(mapperOptions as vue.RawVueCompilerOptions, rootDir);
	const vueOptions = resolver.build();
	if (vueOptions.format === 'petite-vue') {
		vueOptions.globalTemplateContext = true;
	}
	return vueOptions;
}

function normalizePath(fileName: string) {
	return fileName.replace(/\\/g, '/');
}
