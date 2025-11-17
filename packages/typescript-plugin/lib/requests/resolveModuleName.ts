import type * as ts from 'typescript';

export function resolveModuleName(
	ts: typeof import('typescript'),
	languageServiceHost: ts.LanguageServiceHost,
	fileName: string,
	moduleName: string,
): { name?: string } {
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
				fileName = transformFileName(fileName, ext);
			},
		} as ts.ModuleResolutionHost,
	);

	const resolveFileName = result.resolvedModule?.resolvedFileName;
	return {
		name: resolveFileName ? transformFileName(resolveFileName, ext) : undefined,
	};
}

function transformFileName(fileName: string, ext: string | undefined) {
	if (ext && fileName.endsWith(`.d.${ext}.ts`)) {
		return fileName.slice(0, -`.d.${ext}.ts`.length) + `.${ext}`;
	}
	return fileName;
}
