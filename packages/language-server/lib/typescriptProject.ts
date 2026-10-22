import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import type * as ts from 'typescript';

/** The parts of `typescript/async` used here; the module is loaded at runtime from the TS 7 installation. */
interface API {
	getCurrentLanguageServerSnapshot(changes?: { openFiles?: string[]; closeFiles?: string[] }): Promise<Snapshot>;
	close(): Promise<void>;
}

interface Snapshot {
	getDefaultProjectForFile(file: string): Promise<TypeScriptProject | undefined>;
	dispose(): Promise<void>;
}

export interface TypeScriptProject {
	/** Undefined for the TypeScript language server's inferred project. */
	configFileName: string | undefined;
	parsedCommandLine: {
		options: ts.CompilerOptions;
		/**
		 * The config file's own JSON, not merged with `extends`, except that `contentMappers` is replaced by
		 * the resolved (possibly inherited) array. Undefined for inferred projects.
		 */
		raw?: { contentMappers?: unknown[] };
	};
}

export interface TypeScriptProjectResolver {
	/** The file's default project in the running TypeScript language server, or undefined when it has none for it. */
	getProject(fileName: string): Promise<TypeScriptProject | undefined>;
	/** Releases the file opened by `getProject`. */
	closeFile(fileName: string): void;
	/** Forgets the cached answers, e.g. after a config file changed. */
	invalidate(): void;
	dispose(): void;
}

/**
 * Asks the editor's TypeScript language server which project owns a file, over an API pipe the client opened.
 * `packageJsonPath` is the manifest of the TS 7 installation that server runs, so the client matches it.
 */
export async function connectTypeScriptProjectResolver(
	pipe: string,
	packageJsonPath: string,
): Promise<TypeScriptProjectResolver> {
	const manifestPath = fs.realpathSync(packageJsonPath);
	const { name } = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
	const modulePath = createRequire(manifestPath).resolve(`${name}/async`);
	const { API } = await import(pathToFileURL(modulePath).href);
	const api: API = new API({ pipe });
	const projects = new Map<string, Promise<TypeScriptProject | undefined>>();

	async function openSnapshot(fileName: string) {
		try {
			// Opening the file makes the TypeScript language server load its default project even if the editor's didOpen has not reached it yet.
			return await api.getCurrentLanguageServerSnapshot({ openFiles: [fileName] });
		}
		catch {
			// The TypeScript language server refuses to open files no project can hold (e.g. `.vue` without a content mapper); asking the current
			// snapshot then answers "no project", while a broken connection still throws.
			return await api.getCurrentLanguageServerSnapshot();
		}
	}

	return {
		getProject(fileName) {
			let result = projects.get(fileName);
			if (!result) {
				result = openSnapshot(fileName).then(async snapshot => {
					try {
						return await snapshot.getDefaultProjectForFile(fileName);
					}
					finally {
						await snapshot.dispose();
					}
				});
				projects.set(fileName, result);
				result.catch(() => projects.delete(fileName));
			}
			return result;
		},
		closeFile(fileName) {
			if (projects.delete(fileName)) {
				api.getCurrentLanguageServerSnapshot({ closeFiles: [fileName] }).then(snapshot => snapshot.dispose(), () => {});
			}
		},
		invalidate() {
			projects.clear();
		},
		dispose() {
			projects.clear();
			api.close().catch(() => {});
		},
	};
}
