import * as fs from 'fs';
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

export function getWorkspaceTypescriptPath(tsdk: string, workspaceFolderFsPaths: string[]) {
	if (path.isAbsolute(tsdk)) {
		const tsPath = findTypescriptModulePathInLib(tsdk);
		if (tsPath) {
			return tsPath;
		}
	}
	else {
		for (const folder of workspaceFolderFsPaths) {
			const tsPath = findTypescriptModulePathInLib(path.join(folder, tsdk));
			if (tsPath) {
				return tsPath;
			}
		}
	}
}

export function getWorkspaceTypescriptLocalizedPath(tsdk: string, lang: string, workspaceFolderFsPaths: string[]) {
	if (path.isAbsolute(tsdk)) {
		const tsPath = findTypescriptLocalizedPathInLib(tsdk, lang);
		if (tsPath) {
			return tsPath;
		}
	}
	else {
		for (const folder of workspaceFolderFsPaths) {
			const tsPath = findTypescriptLocalizedPathInLib(path.join(folder, tsdk), lang);
			if (tsPath) {
				return tsPath;
			}
		}
	}
}

export function findTypescriptModulePathInLib(lib: string) {

	const tsserverlibrary = path.join(lib, 'tsserverlibrary.js');
	const typescript = path.join(lib, 'typescript.js');
	const tsserver = path.join(lib, 'tsserver.js');

	if (fs.existsSync(tsserverlibrary)) {
		return tsserverlibrary;
	}
	if (fs.existsSync(typescript)) {
		return typescript;
	}
	if (fs.existsSync(tsserver)) {
		return tsserver;
	}
}

export function findTypescriptLocalizedPathInLib(lib: string, lang: string) {

	const localized = path.join(lib, lang, 'diagnosticMessages.generated.json');

	if (fs.existsSync(localized)) {
		return localized;
	}
}

export function getVscodeTypescriptPath(appRoot: string) {
	return path.join(appRoot, 'extensions', 'node_modules', 'typescript', 'lib', 'typescript.js');
}

export function getVscodeTypescriptLocalizedPath(appRoot: string, lang: string): string | undefined {
	const tsPath = path.join(appRoot, 'extensions', 'node_modules', 'typescript', 'lib', lang, 'diagnosticMessages.generated.json');
	if (fs.existsSync(tsPath)) {
		return tsPath;
	}
}

export function getTypeScriptVersion(serverPath: string): string | undefined {
	if (!fs.existsSync(serverPath)) {
		return undefined;
	}

	const p = serverPath.split(path.sep);
	if (p.length <= 2) {
		return undefined;
	}
	const p2 = p.slice(0, -2);
	const modulePath = p2.join(path.sep);
	let fileName = path.join(modulePath, 'package.json');
	if (!fs.existsSync(fileName)) {
		// Special case for ts dev versions
		if (path.basename(modulePath) === 'built') {
			fileName = path.join(modulePath, '..', 'package.json');
		}
	}
	if (!fs.existsSync(fileName)) {
		return undefined;
	}

	const contents = fs.readFileSync(fileName).toString();
	let desc: any = null;
	try {
		desc = JSON.parse(contents);
	} catch (err) {
		return undefined;
	}
	if (!desc || !desc.version) {
		return undefined;
	}
	return desc.version;
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
