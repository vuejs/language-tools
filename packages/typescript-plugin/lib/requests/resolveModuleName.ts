import type * as ts from 'typescript';
import type { RequestContext } from './types';

export function resolveModuleName(
	this: RequestContext,
	fileName: string,
	moduleName: string,
): { name?: string } {
	const { typescript: ts, languageServiceHost } = this;
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
				return languageServiceHost.fileExists?.(fileName);
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
		return fileName.slice(0, -(`.d.${ext}.ts`.length)) + `.${ext}`;
	}
	return fileName;
}
