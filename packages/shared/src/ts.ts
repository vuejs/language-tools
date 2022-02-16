import * as path from 'upath';
import { normalizeFileName } from './path';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { createModuleSpecifierCache } from './moduleSpecifierCache';
import { createPackageJsonCache, PackageJsonInfo, Ternary } from './packageJsonCache';

export function addCacheLogicToLanguageServiceHost(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	host: ts.LanguageServiceHost,
	service: ts.LanguageService,
) {

	const moduleSpecifierCache = createModuleSpecifierCache();
	const exportMapCache = (ts as any).createCacheableExportInfoMap({
		getCurrentProgram() {
			return service.getProgram()
		},
		getPackageJsonAutoImportProvider() {
			return service.getProgram()
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
					const packageJsonFileName = (ts as any).combinePaths(directory, "package.json");
					// this.watchPackageJsonFile(packageJsonFileName as ts.Path); // TODO
					const info = packageJsonCache.getInDirectory(directory);
					if (info) result.push(info);
			}
			if (rootPath && rootPath === directory) {
				return true;
			}
		};

		(ts as any).forEachAncestorDirectory((ts as any).getDirectoryPath(filePath), processDirectory);
		return result;
	};

	function toPath(fileName: string) {
		return (ts as any).toPath(fileName, host.getCurrentDirectory(), (ts as any).createGetCanonicalFileName(host.useCaseSensitiveFileNames?.()));
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
	}
} {

	const tsConfigPath = ts.sys.resolvePath(tsConfig);
	const config = ts.readJsonConfigFile(tsConfigPath, ts.sys.readFile);
	const content = ts.parseJsonSourceFileConfigFileContent(config, parseConfigHost, path.dirname(tsConfigPath), {}, path.basename(tsConfigPath));
	content.options.outDir = undefined; // TODO: patching ts server broke with outDir + rootDir + composite/incremental
	content.fileNames = content.fileNames.map(normalizeFileName);

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
			console.log('Failed to require "experimentalTemplateCompilerOptionsRequirePath":', templateOptionsPath);
			console.error(error);
		}
	}

	return result;
}
