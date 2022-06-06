import type { Path, UserPreferences, SourceFile } from 'typescript/lib/tsserverlibrary';

export interface ModulePath {
	path: string;
	isInNodeModules: boolean;
	isRedirect: boolean;
}

export interface ResolvedModuleSpecifierInfo {
	modulePaths: readonly ModulePath[] | undefined;
	moduleSpecifiers: readonly string[] | undefined;
	isBlockedByPackageJsonDependencies: boolean | undefined;
}

export interface ModuleSpecifierOptions {
	overrideImportMode?: SourceFile["impliedNodeFormat"];
}

export interface ModuleSpecifierCache {
	get(fromFileName: Path, toFileName: Path, preferences: UserPreferences, options: ModuleSpecifierOptions): Readonly<ResolvedModuleSpecifierInfo> | undefined;
	set(fromFileName: Path, toFileName: Path, preferences: UserPreferences, options: ModuleSpecifierOptions, modulePaths: readonly ModulePath[], moduleSpecifiers: readonly string[]): void;
	setBlockedByPackageJsonDependencies(fromFileName: Path, toFileName: Path, preferences: UserPreferences, options: ModuleSpecifierOptions, isBlockedByPackageJsonDependencies: boolean): void;
	setModulePaths(fromFileName: Path, toFileName: Path, preferences: UserPreferences, options: ModuleSpecifierOptions, modulePaths: readonly ModulePath[]): void;
	clear(): void;
	count(): number;
}

export interface FileWatcher {
	close(): void;
}

export interface ModuleSpecifierResolutionCacheHost {
	watchNodeModulesForPackageJsonChanges(directoryPath: string): FileWatcher;
}

export const nodeModulesPathPart = "/node_modules/";

export function createModuleSpecifierCache(
	// host: ModuleSpecifierResolutionCacheHost
): ModuleSpecifierCache {
	let containedNodeModulesWatchers: Map<string, FileWatcher> | undefined;
	let cache: Map<Path, ResolvedModuleSpecifierInfo> | undefined;
	let currentKey: string | undefined;
	const result: ModuleSpecifierCache = {
		get(fromFileName, toFileName, preferences, options) {
			if (!cache || currentKey !== key(fromFileName, preferences, options)) return undefined;
			return cache.get(toFileName);
		},
		set(fromFileName, toFileName, preferences, options, modulePaths, moduleSpecifiers) {
			ensureCache(fromFileName, preferences, options).set(toFileName, createInfo(modulePaths, moduleSpecifiers, /*isBlockedByPackageJsonDependencies*/ false));

			// If any module specifiers were generated based off paths in node_modules,
			// a package.json file in that package was read and is an input to the cached.
			// Instead of watching each individual package.json file, set up a wildcard
			// directory watcher for any node_modules referenced and clear the cache when
			// it sees any changes.
			if (moduleSpecifiers) {
				for (const p of modulePaths) {
					if (p.isInNodeModules) {
						// No trailing slash
						// const nodeModulesPath = p.path.substring(0, p.path.indexOf(nodeModulesPathPart) + nodeModulesPathPart.length - 1);
						// if (!containedNodeModulesWatchers?.has(nodeModulesPath)) {
						//     (containedNodeModulesWatchers ||= new Map()).set(
						//         nodeModulesPath,
						//         host.watchNodeModulesForPackageJsonChanges(nodeModulesPath),
						//     );
						// }
					}
				}
			}
		},
		setModulePaths(fromFileName, toFileName, preferences, options, modulePaths) {
			const cache = ensureCache(fromFileName, preferences, options);
			const info = cache.get(toFileName);
			if (info) {
				info.modulePaths = modulePaths;
			}
			else {
				cache.set(toFileName, createInfo(modulePaths, /*moduleSpecifiers*/ undefined, /*isBlockedByPackageJsonDependencies*/ undefined));
			}
		},
		setBlockedByPackageJsonDependencies(fromFileName, toFileName, preferences, options, isBlockedByPackageJsonDependencies) {
			const cache = ensureCache(fromFileName, preferences, options);
			const info = cache.get(toFileName);
			if (info) {
				info.isBlockedByPackageJsonDependencies = isBlockedByPackageJsonDependencies;
			}
			else {
				cache.set(toFileName, createInfo(/*modulePaths*/ undefined, /*moduleSpecifiers*/ undefined, isBlockedByPackageJsonDependencies));
			}
		},
		clear() {
			containedNodeModulesWatchers?.forEach(watcher => watcher.close());
			cache?.clear();
			containedNodeModulesWatchers?.clear();
			currentKey = undefined;
		},
		count() {
			return cache ? cache.size : 0;
		}
	};
	// if (Debug.isDebugging) {
	//     Object.defineProperty(result, "__cache", { get: () => cache });
	// }
	return result;

	function ensureCache(fromFileName: Path, preferences: UserPreferences, options: ModuleSpecifierOptions) {
		const newKey = key(fromFileName, preferences, options);
		if (cache && (currentKey !== newKey)) {
			result.clear();
		}
		currentKey = newKey;
		return cache ||= new Map();
	}

	function key(fromFileName: Path, preferences: UserPreferences, options: ModuleSpecifierOptions) {
		return `${fromFileName},${preferences.importModuleSpecifierEnding},${preferences.importModuleSpecifierPreference},${options.overrideImportMode}`;
	}

	function createInfo(
		modulePaths: readonly ModulePath[] | undefined,
		moduleSpecifiers: readonly string[] | undefined,
		isBlockedByPackageJsonDependencies: boolean | undefined,
	): ResolvedModuleSpecifierInfo {
		return { modulePaths, moduleSpecifiers, isBlockedByPackageJsonDependencies };
	}
}
