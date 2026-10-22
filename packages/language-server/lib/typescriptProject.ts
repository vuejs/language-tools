import { names, type VueVirtualCode } from '@vue/language-core';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import type { ComponentMeta, TypeScript } from 'vue-component-meta';
import { getComponentMetaOfType } from 'vue-component-meta/lib/componentMeta';
import { findVariable, getComponentType } from './componentMeta';

type SourceFile = import('typescript-7/ast', { with: { 'resolution-mode': 'import' }}).SourceFile;
type Project = import('typescript-7/async', { with: { 'resolution-mode': 'import' }}).Project;

const directiveRE = /^v[A-Z]/;

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
	/** The intrinsic element names available in the template of the Vue file `fileName`. */
	getElementNames(fileName: string): Promise<string[] | undefined>;
	/** The directive names (`vFoo`) available in the template of the Vue file `fileName`. */
	getComponentDirectives(fileName: string): Promise<string[] | undefined>;
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

	async function withProject<T>(fileName: string, fn: (project: Project) => Promise<T | undefined>) {
		const snapshot = await openSnapshot(fileName);
		try {
			const project = await snapshot.getDefaultProjectForFile(fileName);
			return project && await fn(project);
		}
		finally {
			await snapshot.dispose();
		}
	}

	function withSourceFile<T>(
		fileName: string,
		fn: (project: Project, sourceFile: SourceFile) => Promise<T | undefined>,
	) {
		return withProject(fileName, async project => {
			const sourceFile = await project.program.getSourceFile(fileName);
			return sourceFile && await fn(project, sourceFile);
		});
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
		getDefaultImportEdits(fileName, incomingFileName) {
			return withProject(fileName, async project => {
				const moduleSymbol = await project.checker.getSymbolOfSourceFile(incomingFileName);
				const defaultExport = moduleSymbol && await project.checker.getMemberInModuleExports(moduleSymbol, 'default');
				return defaultExport && await project.languageService.getImportEditsForSymbols(fileName, [defaultExport]);
			});
		},
		getComponentMeta(fileName, virtualCode, tag) {
			return withSourceFile(fileName, async (project, sourceFile) => {
				const component = await getComponentType(ts, project.checker, sourceFile, virtualCode, tag);
				return component && await getComponentMetaOfType(ts, project, component.type, component.node);
			});
		},
		getElementNames(fileName) {
			return withSourceFile(fileName, async (project, sourceFile) => {
				const intrinsics = findVariable(ts, sourceFile, names.intrinsics);
				const type = intrinsics && await project.checker.getTypeAtLocation(intrinsics);
				return type && (await type.getProperties()).map(symbol => symbol.name);
			});
		},
		getComponentDirectives(fileName) {
			return withSourceFile(fileName, async (project, sourceFile) => {
				const directives = findVariable(ts, sourceFile, names.directives);
				const type = directives && await project.checker.getTypeAtLocation(directives);
				return type && (await type.getProperties())
					.map(symbol => symbol.name)
					.filter(name => directiveRE.test(name));
			});
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
