import { posix as path } from 'path-browserify';
import type * as ts from 'typescript';

export function resolveModuleName(
	ts: typeof import('typescript'),
	languageServiceHost: ts.LanguageServiceHost,
	fileName: string,
	moduleName: string,
	allowNonExistent: boolean = false,
): string | undefined {
	const compilerOptions = languageServiceHost.getCompilationSettings();

	const ext = moduleName.split('.').pop();
	const result = ts.resolveModuleName(
		moduleName,
		fileName,
		{
			...compilerOptions,
			allowArbitraryExtensions: true,
		},
		{
			fileExists(fileName) {
				return languageServiceHost.fileExists(
					transformFileName(fileName, ext),
				);
			},
			readFile: languageServiceHost.readFile.bind(languageServiceHost),
		},
	);

	const resolved = result.resolvedModule?.resolvedFileName;
	if (resolved) {
		return transformFileName(resolved, ext);
	}

	if (allowNonExistent && 'failedLookupLocations' in result) {
		const alternative = (result.failedLookupLocations as string[])?.[0];
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
