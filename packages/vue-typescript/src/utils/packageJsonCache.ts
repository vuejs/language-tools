import type { Path, server } from 'typescript/lib/tsserverlibrary';

export const enum PackageJsonDependencyGroup {
	Dependencies = 1 << 0,
	DevDependencies = 1 << 1,
	PeerDependencies = 1 << 2,
	OptionalDependencies = 1 << 3,
	All = Dependencies | DevDependencies | PeerDependencies | OptionalDependencies,
}

export interface PackageJsonInfo {
	fileName: string;
	parseable: boolean;
	dependencies?: Map<string, string>;
	devDependencies?: Map<string, string>;
	peerDependencies?: Map<string, string>;
	optionalDependencies?: Map<string, string>;
	get(dependencyName: string, inGroups?: PackageJsonDependencyGroup): string | undefined;
	has(dependencyName: string, inGroups?: PackageJsonDependencyGroup): boolean;
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

export function canCreatePackageJsonCache(ts: typeof import('typescript/lib/tsserverlibrary')) {
	return 'createPackageJsonInfo' in ts && 'getDirectoryPath' in ts && 'combinePaths' in ts && 'tryFileExists' in ts && 'forEachAncestorDirectory' in ts;
}

export function createPackageJsonCache(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	host: ProjectService,
): PackageJsonCache {
	const { createPackageJsonInfo, getDirectoryPath, combinePaths, tryFileExists, forEachAncestorDirectory } = ts as any;
	const packageJsons = new Map<string, PackageJsonInfo>();
	const directoriesWithoutPackageJson = new Map<string, true>();
	return {
		addOrUpdate,
		// @ts-expect-error
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
			// @ts-expect-error
			forEachAncestorDirectory(directory, ancestor => {
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
