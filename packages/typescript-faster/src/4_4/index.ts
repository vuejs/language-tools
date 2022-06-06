import { createModuleSpecifierCache } from './moduleSpecifierCache';
import { createPackageJsonCache, canCreatePackageJsonCache, PackageJsonInfo, Ternary } from './packageJsonCache';

export default function (
	ts: typeof import('typescript/lib/tsserverlibrary'),
	host: ts.LanguageServiceHost,
	service: ts.LanguageService,
) {

	const _createCacheableExportInfoMap = (ts as any).createCacheableExportInfoMap;
	const _combinePaths = (ts as any).combinePaths;
	const _forEachAncestorDirectory = (ts as any).forEachAncestorDirectory;
	const _getDirectoryPath = (ts as any).getDirectoryPath;
	const _toPath = (ts as any).toPath;
	const _createGetCanonicalFileName = (ts as any).createGetCanonicalFileName;

	if (
		!_createCacheableExportInfoMap
		|| !_combinePaths
		|| !_forEachAncestorDirectory
		|| !_getDirectoryPath
		|| !_toPath
		|| !_createGetCanonicalFileName
		|| !canCreatePackageJsonCache(ts)
	) return;

	const moduleSpecifierCache = createModuleSpecifierCache();
	const exportMapCache = _createCacheableExportInfoMap({
		getCurrentProgram() {
			return service.getProgram();
		},
		getPackageJsonAutoImportProvider() {
			return service.getProgram();
		},
	});
	const packageJsonCache = createPackageJsonCache(ts, {
		...host,
		// @ts-expect-error
		host: { ...host },
		toPath,
	});

	// @ts-expect-error
	host.getCachedExportInfoMap = () => exportMapCache;
	// @ts-expect-error
	host.getModuleSpecifierCache = () => moduleSpecifierCache;
	// @ts-expect-error
	host.getPackageJsonsVisibleToFile = (fileName: string, rootDir?: string) => {
		const rootPath = rootDir && toPath(rootDir);
		const filePath = toPath(fileName);
		const result: PackageJsonInfo[] = [];
		const processDirectory = (directory: ts.Path): boolean | undefined => {
			switch (packageJsonCache.directoryHasPackageJson(directory)) {
				// Sync and check same directory again
				case Ternary.Maybe:
					packageJsonCache.searchDirectoryAndAncestors(directory);
					return processDirectory(directory);
				// Check package.json
				case Ternary.True:
					const packageJsonFileName = _combinePaths(directory, "package.json");
					// this.watchPackageJsonFile(packageJsonFileName as ts.Path); // TODO
					const info = packageJsonCache.getInDirectory(directory);
					if (info) result.push(info);
			}
			if (rootPath && rootPath === directory) {
				return true;
			}
		};

		_forEachAncestorDirectory(_getDirectoryPath(filePath), processDirectory);
		return result;
	};

	function toPath(fileName: string) {
		return _toPath(fileName, host.getCurrentDirectory(), _createGetCanonicalFileName(host.useCaseSensitiveFileNames?.()));
	}
}
