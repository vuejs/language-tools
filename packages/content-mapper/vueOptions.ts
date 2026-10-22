import * as vue from '@vue/language-core';
import * as path from 'node:path';
import type * as ts from 'typescript';
import type { MapperOptions } from './protocol';

/**
 * Resolves the Vue compiler options of one mapper entry from its `options`; `contentMappers` is the
 * config's resolved array, whose `@vue/content-mapper` entries give `extensionFormats`. The language
 * server calls this too, so both produce the same virtual code; `ts` is passed in so importing this
 * module never loads TypeScript.
 */
export function resolveVueCompilerOptions(
	ts: typeof import('typescript'),
	host: Omit<ts.ParseConfigHost, 'readDirectory'>,
	configFileName: string | undefined,
	options: MapperOptions | undefined,
	contentMappers: unknown[] | undefined,
) {
	const rootDir = normalizePath(configFileName ? path.dirname(configFileName) : process.cwd());
	const { languageFeatures, ...mapperOptions } = options ?? {};
	const resolver = new vue.CompilerOptionsResolver(ts, host.readFile);
	resolver.addConfig(mapperOptions as vue.RawVueCompilerOptions, rootDir);
	const vueOptions = vue.withExtensionFormats(resolver.build(), contentMappers);
	if (vueOptions.format === 'petite-vue') {
		vueOptions.globalTemplateContext = true;
	}
	return vueOptions;
}

function normalizePath(fileName: string) {
	return fileName.replace(/\\/g, '/');
}
