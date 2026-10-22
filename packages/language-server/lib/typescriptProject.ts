import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

/** The parts of `typescript/async` used here; the module is loaded at runtime from the TS 7 installation. */
interface API {
	getCurrentLanguageServerSnapshot(changes?: { openFiles?: string[]; closeFiles?: string[] }): Promise<Snapshot>;
	close(): Promise<void>;
}

interface Snapshot {
	getDefaultProjectForFile(file: string): Promise<
		| {
			configFileName: string | undefined;
			parsedCommandLine: {
				/**
				 * The config file's own JSON, not merged with `extends`, except that `contentMappers` is replaced by
				 * the resolved (possibly inherited) array. Undefined for inferred projects.
				 */
				raw?: { contentMappers?: unknown[] };
			};
			checker: {
				getSymbolOfSourceFile(file: string): Promise<object | undefined>;
				getMemberInModuleExports(symbol: object, name: string): Promise<object | undefined>;
			};
			languageService: {
				getImportEditsForSymbols(file: string, symbols: readonly object[]): Promise<readonly TextEdit[]>;
			};
		}
		| undefined
	>;
	dispose(): Promise<void>;
}

/** An edit in UTF-16 offsets of the file's own text (for a content-mapped file, its source text). */
export interface TextEdit {
	pos: number;
	end: number;
	newText: string;
}

export interface TypeScriptProject {
	/** Undefined for the TypeScript language server's inferred project. */
	configFileName: string | undefined;
	/** The config's resolved (possibly inherited) `contentMappers`. */
	contentMappers: unknown[] | undefined;
}

export interface TypeScriptProjectResolver {
	/** The file's default project in the running TypeScript language server, or undefined when it has none for it. */
	getProject(fileName: string): Promise<TypeScriptProject | undefined>;
	/**
	 * The TypeScript language server's edits that add a default import of `incomingFileName` to `fileName`, or
	 * undefined when `incomingFileName` has no default export in `fileName`'s project.
	 */
	getDefaultImportEdits(fileName: string, incomingFileName: string): Promise<readonly TextEdit[] | undefined>;
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
						const project = await snapshot.getDefaultProjectForFile(fileName);
						return project && {
							configFileName: project.configFileName,
							contentMappers: project.parsedCommandLine.raw?.contentMappers,
						};
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
		async getDefaultImportEdits(fileName, incomingFileName) {
			const snapshot = await api.getCurrentLanguageServerSnapshot({ openFiles: [fileName] });
			try {
				const project = await snapshot.getDefaultProjectForFile(fileName);
				const moduleSymbol = await project?.checker.getSymbolOfSourceFile(incomingFileName);
				const defaultExport = moduleSymbol && await project!.checker.getMemberInModuleExports(moduleSymbol, 'default');
				return defaultExport && await project!.languageService.getImportEditsForSymbols(fileName, [defaultExport]);
			}
			finally {
				await snapshot.dispose();
			}
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
