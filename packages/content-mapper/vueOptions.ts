import * as vue from '@vue/language-core';
import * as path from 'node:path';
import type * as ts from 'typescript';
import type { MapperOptions } from './protocol';

/**
 * Resolves the Vue compiler options of one mapper entry: a tsconfig's legacy `vueCompilerOptions`
 * with the entry's `options` applied on top. The language server calls this too, so both produce the
 * same virtual code; `ts` is passed in so importing this module never loads TypeScript.
 */
export function resolveVueCompilerOptions(
	ts: typeof import('typescript'),
	host: Omit<ts.ParseConfigHost, 'readDirectory'>,
	configFileName: string | undefined,
	options: MapperOptions | undefined,
) {
	const rootDir = normalizePath(configFileName ? path.dirname(configFileName) : process.cwd());
	const { languageFeatures, ...mapperOptions } = options ?? {};
	const parsed = configFileName
		? vue.createParsedCommandLine(ts, host, normalizePath(configFileName))
		: undefined;
	// v4 moves the Vue compiler options from the tsconfig's `vueCompilerOptions` field to the mapper
	// entry's `options`; apply the entry options on top of any options a tsconfig still carries.
	const baseVueOptions = parsed?.vueOptions ?? vue.getDefaultCompilerOptions();
	const resolver = new vue.CompilerOptionsResolver(ts, host.readFile);
	resolver.addConfig(mapperOptions as vue.RawVueCompilerOptions, rootDir);
	const vueOptions = resolver.build({
		...baseVueOptions,
		target: resolver.target ?? baseVueOptions.target,
		typesRoot: resolver.typesRoot ?? baseVueOptions.typesRoot,
	});
	vueOptions.plugins = [...new Set([...baseVueOptions.plugins, ...resolver.plugins])];
	if (vueOptions.format === 'petite-vue') {
		vueOptions.globalTemplateContext = true;
	}
	return { parsed, vueOptions };
}

function normalizePath(fileName: string) {
	return fileName.replace(/\\/g, '/');
}
