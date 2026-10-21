import * as path from 'node:path';
import type * as ts from 'typescript';

/**
 * Local replacement for the `_vue:resolveModuleName` bridge request. Mirrors the resolution the
 * typescript-plugin performed inside tsserver: `allowArbitraryExtensions` plus the `.d.<ext>.ts`
 * unwrapping used for content-mapped files, with a best-effort path for non-existent modules.
 * The lookup stays local because the TypeScript API reports no `failedLookupLocations`, which the
 * best-effort path for `<style>` `@import` aliases needs.
 */
export function resolveModuleName(
	ts: typeof import('typescript'),
	compilerOptions: ts.CompilerOptions,
	fileName: string,
	moduleName: string,
	allowNonExistent?: boolean,
): string | undefined {
	const ext = moduleName.split('.').pop();
	const result = ts.resolveModuleName(
		moduleName,
		fileName,
		{ ...compilerOptions, allowArbitraryExtensions: true },
		ts.sys,
	);
	const resolved = result.resolvedModule?.resolvedFileName;
	if (resolved) {
		return transformFileName(resolved, ext);
	}
	if (allowNonExistent) {
		const alternative = (result as { failedLookupLocations?: string[] }).failedLookupLocations?.[0];
		if (alternative) {
			return path.join(alternative, '..', path.basename(moduleName));
		}
	}
}

function transformFileName(fileName: string, ext: string | undefined) {
	if (ext && fileName.endsWith(`.d.${ext}.ts`)) {
		return fileName.slice(0, -`.d.${ext}.ts`.length) + `.${ext}`;
	}
	return fileName;
}
