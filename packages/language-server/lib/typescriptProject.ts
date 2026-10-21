import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

/** The parts of `typescript/async` used here; the module is loaded at runtime from the TS 7 installation. */
interface API {
	getCurrentLanguageServerSnapshot(changes?: { openFiles?: string[]; closeFiles?: string[] }): Promise<Snapshot>;
	close(): Promise<void>;
}

interface Snapshot {
	getDefaultProjectForFile(file: string): Promise<{ configFileName?: string } | undefined>;
	dispose(): Promise<void>;
}

export interface TypeScriptProjectResolver {
	/** The tsconfig of the file's default project in the running TypeScript language server, or undefined for inferred projects. */
	getConfigFileName(fileName: string): Promise<string | undefined>;
	/** Releases the file opened by `getConfigFileName`. */
	closeFile(fileName: string): void;
	dispose(): void;
}

/**
 * Asks the editor's TypeScript language server which project owns a file, over the API pipe it opened for us.
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
	const configFileNames = new Map<string, Promise<string | undefined>>();

	return {
		getConfigFileName(fileName) {
			let result = configFileNames.get(fileName);
			if (!result) {
				// Opening the file makes the TypeScript language server load its default project even if the editor's didOpen has not reached it yet.
				result = api.getCurrentLanguageServerSnapshot({ openFiles: [fileName] }).then(async snapshot => {
					try {
						return (await snapshot.getDefaultProjectForFile(fileName))?.configFileName;
					}
					finally {
						await snapshot.dispose();
					}
				});
				configFileNames.set(fileName, result);
				result.catch(() => configFileNames.delete(fileName));
			}
			return result;
		},
		closeFile(fileName) {
			if (configFileNames.delete(fileName)) {
				api.getCurrentLanguageServerSnapshot({ closeFiles: [fileName] }).then(snapshot => snapshot.dispose(), () => {});
			}
		},
		dispose() {
			configFileNames.clear();
			api.close().catch(() => {});
		},
	};
}
