import type { VueCompilerOptions } from '@vue/language-core';
import { posix as path } from 'path-browserify';
import type * as ts from 'typescript';

interface ParseConfigHost extends Omit<ts.ParseConfigHost, 'readDirectory'> {}

/**
 * The format of each extension of a tsconfig's `@vue/content-mapper` entries, or `.vue` as an SFC without
 * `contentMappers`. tsserver hands every such file to this plugin, so it routes each one itself.
 */
export function getExtensionFormats(
	ts: typeof import('typescript'),
	host: ParseConfigHost,
	configFileName: string | undefined,
) {
	const contentMappers = configFileName ? resolveContentMappers(ts, host, configFileName) : undefined;
	if (!contentMappers) {
		return { '.vue': 'sfc' } as Record<string, VueCompilerOptions['format']>;
	}
	const extensionFormats: Record<string, VueCompilerOptions['format']> = {};
	for (const entry of contentMappers as any[]) {
		if (entry?.package === '@vue/content-mapper' && Array.isArray(entry.extensions)) {
			for (const extension of entry.extensions) {
				extensionFormats[extension] = entry.options?.format ?? 'sfc';
			}
		}
	}
	return extensionFormats;
}

/**
 * Resolves a tsconfig's `contentMappers` the way TS 7 does: the array is never merged; the config's own
 * array wins (even an empty one), otherwise the last `extends` entry that resolves to one wins.
 */
export function resolveContentMappers(
	ts: typeof import('typescript'),
	host: ParseConfigHost,
	configFileName: string,
	json: any = ts.readConfigFile(configFileName, host.readFile).config,
	ancestors = new Set<string>(),
): unknown[] | undefined {
	if (json?.contentMappers !== undefined) {
		return Array.isArray(json.contentMappers) ? json.contentMappers : undefined;
	}
	let result: unknown[] | undefined;
	ancestors.add(configFileName);
	for (const specifier of [json?.extends].flat()) {
		if (typeof specifier !== 'string') {
			continue;
		}
		const extendedConfigFileName = resolveExtends(ts, host, configFileName, specifier);
		if (extendedConfigFileName && !ancestors.has(extendedConfigFileName)) {
			result = resolveContentMappers(ts, host, extendedConfigFileName, undefined, ancestors) ?? result;
		}
	}
	ancestors.delete(configFileName);
	return result;
}

/** Resolves an `extends` specifier with TypeScript's own resolution, including package specifiers. */
function resolveExtends(
	ts: typeof import('typescript'),
	host: ParseConfigHost,
	configFileName: string,
	specifier: string,
) {
	const sourceFile = ts.readJsonConfigFile(configFileName, () => JSON.stringify({ extends: specifier }));
	ts.parseJsonSourceFileConfigFileContent(
		sourceFile,
		{ ...host, readDirectory: () => [] },
		path.dirname(configFileName),
		{},
		configFileName,
	);
	return sourceFile.extendedSourceFiles?.[0];
}
