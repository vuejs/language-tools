import type { Path, server } from 'typescript/lib/tsserverlibrary';

interface PackageJsonPathFields {
	typings?: string;
	types?: string;
	typesVersions?: Map<string, Map<string, string[]>>;
	main?: string;
	tsconfig?: string;
	type?: string;
	imports?: object;
	exports?: object;
	name?: string;
}

interface VersionPaths {
	version: string;
	paths: Map<string, string[]>;
}

export interface PackageJsonInfo {
	packageDirectory: string;
	packageJsonContent: PackageJsonPathFields;
	versionPaths: VersionPaths | undefined;
	/** false: resolved to nothing. undefined: not yet resolved */
	resolvedEntrypoints: string[] | false | undefined;
}

export const enum Ternary {
	False = 0,
	Unknown = 1,
	Maybe = 3,
	True = -1
}

type ProjectService = server.ProjectService;

export interface PackageJsonCache {
	addOrUpdate(fileName: Path): void;
	forEach(action: (info: PackageJsonInfo, fileName: Path) => void): void;
	delete(fileName: Path): void;
	get(fileName: Path): PackageJsonInfo | false | undefined;
	getInDirectory(directory: Path): PackageJsonInfo | undefined;
	directoryHasPackageJson(directory: Path): Ternary;
	searchDirectoryAndAncestors(directory: Path): void;
}

export function createPackageJsonCache(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	host: ProjectService,
): PackageJsonCache {
	const { createPackageJsonInfo, getDirectoryPath, combinePaths, tryFileExists, forEachAncestorDirectory } = ts as any;
	const packageJsons = new Map<Path, PackageJsonInfo>();
	const directoriesWithoutPackageJson = new Map<Path, true>();
	return {
		addOrUpdate,
		forEach: packageJsons.forEach.bind(packageJsons),
		get: packageJsons.get.bind(packageJsons),
		delete: fileName => {
			packageJsons.delete(fileName);
			directoriesWithoutPackageJson.set(getDirectoryPath(fileName), true);
		},
		getInDirectory: directory => {
			return packageJsons.get(combinePaths(directory, "package.json")) || undefined;
		},
		directoryHasPackageJson,
		searchDirectoryAndAncestors: directory => {
			forEachAncestorDirectory(directory, (ancestor: Path) => {
				if (directoryHasPackageJson(ancestor) !== Ternary.Maybe) {
					return true;
				}
				const packageJsonFileName = host.toPath(combinePaths(ancestor, "package.json"));
				if (tryFileExists(host, packageJsonFileName)) {
					addOrUpdate(packageJsonFileName);
				}
				else {
					directoriesWithoutPackageJson.set(ancestor, true);
				}
			});
		},
	};

	function addOrUpdate(fileName: Path) {
		const packageJsonInfo =
			// Debug.checkDefined(
			createPackageJsonInfo(fileName, host.host);
		// );
		packageJsons.set(fileName, packageJsonInfo);
		directoriesWithoutPackageJson.delete(getDirectoryPath(fileName));
	}

	function directoryHasPackageJson(directory: Path) {
		return packageJsons.has(combinePaths(directory, "package.json")) ? Ternary.True :
			directoriesWithoutPackageJson.has(directory) ? Ternary.False :
				Ternary.Maybe;
	}
}
