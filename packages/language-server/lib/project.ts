import * as path from 'node:path';
import type * as ts from 'typescript';

export interface ProjectResolver {
	/** The tsconfig that owns `fileName`, or undefined when no tsconfig includes it. */
	getConfigFileName(fileName: string): string | undefined;
	/** The parsed command line of `fileName`'s owning tsconfig, or undefined. */
	getCommandLine(fileName: string): ts.ParsedCommandLine | undefined;
	dispose(): void;
}

/**
 * Resolves which tsconfig owns a file without asking a TypeScript server. The language server used to
 * forward `projectInfo` to tsserver through the `@vue/typescript-plugin` bridge; that bridge does not
 * exist for TS 7, so project routing is done locally.
 */
export function createProjectResolver(ts: typeof import('typescript')): ProjectResolver {
	const commandLines = new Map<string, ts.ParsedCommandLine | undefined>();
	const fileToConfig = new Map<string, string | undefined>();

	function getCommandLine(configFileName: string) {
		if (!commandLines.has(configFileName)) {
			commandLines.set(configFileName, parseCommandLine(ts, configFileName));
		}
		return commandLines.get(configFileName);
	}

	function isOwned(configFileName: string, fileName: string) {
		const commandLine = getCommandLine(configFileName);
		return !!commandLine?.fileNames.some(candidate => sameFile(candidate, fileName));
	}

	function search(fileName: string) {
		let dir = path.dirname(fileName);
		while (true) {
			const configFileName = ts.findConfigFile(dir, ts.sys.fileExists);
			if (!configFileName) {
				return undefined;
			}
			if (isOwned(configFileName, fileName)) {
				return configFileName;
			}
			// The nearest tsconfig does not include the file (e.g. a solution-style config that only
			// holds references); keep looking in the parent directory.
			const parent = path.dirname(path.dirname(configFileName));
			if (parent === path.dirname(configFileName)) {
				return undefined;
			}
			dir = parent;
		}
	}

	const resolver: ProjectResolver = {
		getConfigFileName(fileName) {
			if (!fileToConfig.has(fileName)) {
				fileToConfig.set(fileName, search(fileName));
			}
			return fileToConfig.get(fileName);
		},
		getCommandLine(fileName) {
			const configFileName = resolver.getConfigFileName(fileName);
			return configFileName ? getCommandLine(configFileName) : undefined;
		},
		dispose() {
			commandLines.clear();
			fileToConfig.clear();
		},
	};
	return resolver;
}

/**
 * `.vue` files are not part of TypeScript's supported extensions, so a plain parse never lists them;
 * pass the extension explicitly to get a `fileNames` list that can decide ownership.
 */
function parseCommandLine(ts: typeof import('typescript'), configFileName: string): ts.ParsedCommandLine | undefined {
	try {
		return ts.parseJsonSourceFileConfigFileContent(
			ts.readJsonConfigFile(configFileName, ts.sys.readFile),
			ts.sys,
			path.dirname(configFileName),
			{},
			configFileName,
			undefined,
			[{ extension: 'vue', isMixedContent: true, scriptKind: ts.ScriptKind.Deferred }],
		);
	}
	catch {
		return undefined;
	}
}

function sameFile(a: string, b: string) {
	return a.replace(/\\/g, '/').toLowerCase() === b.replace(/\\/g, '/').toLowerCase();
}

/**
 * Local replacement for the `_vue:resolveModuleName` bridge request. Mirrors the resolution the
 * typescript-plugin performed inside tsserver: `allowArbitraryExtensions` plus the `.d.<ext>.ts`
 * unwrapping used for content-mapped files, with a best-effort path for non-existent modules.
 */
export function resolveModuleName(
	ts: typeof import('typescript'),
	compilerOptions: ts.CompilerOptions,
	fileName: string,
	moduleName: string,
	allowNonExistent?: boolean,
): string | undefined {
	const ext = moduleName.split('.').pop();
	const result = ts.resolveModuleName(
		moduleName,
		fileName,
		{ ...compilerOptions, allowArbitraryExtensions: true },
		ts.sys,
	);
	const resolved = result.resolvedModule?.resolvedFileName;
	if (resolved) {
		return transformFileName(resolved, ext);
	}
	if (allowNonExistent) {
		const alternative = (result as { failedLookupLocations?: string[] }).failedLookupLocations?.[0];
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
