import type * as ts from 'typescript/lib/tsserverlibrary';
import { createModuleSpecifierCache } from './moduleSpecifierCache';
import { createPackageJsonCache, canCreatePackageJsonCache, PackageJsonInfo, Ternary } from './packageJsonCache';
import * as path from 'path';

export function injectCacheLogicToLanguageServiceHost(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	host: ts.LanguageServiceHost,
	service: ts.LanguageService,
) {

	const versionNums = ts.version.split('.').map(s => Number(s));
	if (versionNums[0] > 4 || (versionNums[0] === 4 && versionNums[1] >= 7)) {
		console.log('Please update to v0.35.0 or higher to support TypeScript version:', ts.version);
		return;
	}

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

export function createParsedCommandLine(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	parseConfigHost: ts.ParseConfigHost,
	tsConfig: string,
	extendsSet = new Set<string>(),
): ts.ParsedCommandLine & {
	vueOptions: {
		experimentalCompatMode?: 2 | 3;
		experimentalTemplateCompilerOptions?: any;
		experimentalTemplateCompilerOptionsRequirePath?: string;
	};
} {

	const tsConfigPath = ts.sys.resolvePath(tsConfig);
	const config = ts.readJsonConfigFile(tsConfigPath, ts.sys.readFile);
	const content = ts.parseJsonSourceFileConfigFileContent(config, parseConfigHost, path.dirname(tsConfigPath), {}, path.basename(tsConfigPath));
	content.options.outDir = undefined; // TODO: patching ts server broke with outDir + rootDir + composite/incremental

	let baseVueOptions = {};
	const folder = path.dirname(tsConfig);

	extendsSet.add(tsConfig);

	if (content.raw.extends) {
		try {
			const extendsPath = require.resolve(content.raw.extends, { paths: [folder] });
			if (!extendsSet.has(extendsPath)) {
				baseVueOptions = createParsedCommandLine(ts, parseConfigHost, extendsPath, extendsSet).vueOptions;
			}
		}
		catch (error) {
			console.error(error);
		}
	}

	return {
		...content,
		vueOptions: {
			...baseVueOptions,
			...resolveVueCompilerOptions(content.raw.vueCompilerOptions ?? {}, folder),
		},
	};
}

function resolveVueCompilerOptions(rawOptions: {
	[key: string]: any,
	experimentalTemplateCompilerOptionsRequirePath?: string,
}, rootPath: string) {

	const result = { ...rawOptions };

	let templateOptionsPath = rawOptions.experimentalTemplateCompilerOptionsRequirePath;
	if (templateOptionsPath) {
		if (!path.isAbsolute(templateOptionsPath)) {
			templateOptionsPath = require.resolve(templateOptionsPath, { paths: [rootPath] });
		}
		try {
			result.experimentalTemplateCompilerOptions = require(templateOptionsPath).default;
		} catch (error) {
			console.warn('Failed to require "experimentalTemplateCompilerOptionsRequirePath":', templateOptionsPath);
			console.error(error);
		}
	}

	return result;
}
