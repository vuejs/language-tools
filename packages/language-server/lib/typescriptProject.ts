import type { VueVirtualCode } from '@vue/language-core';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import type { ComponentMeta, ComponentMetaContext, TypeScript } from 'vue-component-meta';
import { getComponentMetaOfType } from 'vue-component-meta/lib/componentMeta';
import { getComponentType } from './componentMeta';

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
	/** The metadata of the component that `tag` refers to in the template of the Vue file `fileName`. */
	getComponentMeta(fileName: string, virtualCode: VueVirtualCode, tag: string): Promise<ComponentMeta | undefined>;
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
	const require = createRequire(manifestPath);
	const ts: TypeScript = {
		...await import(pathToFileURL(require.resolve(`${name}/ast`)).href),
		...await import(pathToFileURL(require.resolve(`${name}/async`)).href),
	};
	const api = await ts.API.fromLSPConnection({ pipe });
	const context: ComponentMetaContext = { ts, printer: api.printer };
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
							// The config file's own JSON, not merged with `extends`, except that `contentMappers` is replaced by
							// the resolved (possibly inherited) array. Undefined for inferred projects.
							contentMappers: (project.parsedCommandLine.raw as { contentMappers?: unknown[] } | undefined)
								?.contentMappers,
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
		async getComponentMeta(fileName, virtualCode, tag) {
			const snapshot = await api.getCurrentLanguageServerSnapshot({ openFiles: [fileName] });
			try {
				const project = await snapshot.getDefaultProjectForFile(fileName);
				const sourceFile = await project?.program.getSourceFile(fileName);
				const component = sourceFile
					&& await getComponentType(ts, project!.checker, sourceFile, virtualCode, tag);
				return component && await getComponentMetaOfType(context, project!, component.type, component.node);
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
