import { names, type VueVirtualCode } from '@vue/language-core';
import type {
	AutoImportComponent,
	AutoImportExport,
	ComponentPropInfo,
	DefinitionLocation,
	ExtractPropsInfo,
	TextEdit,
} from '@vue/language-service/lib/requests';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import type { ComponentMeta, TypeScript } from 'vue-component-meta';
import { getComponentMetaOfType } from 'vue-component-meta/lib/componentMeta';
import {
	collectExtractProps,
	findVariable,
	getComponentDefinition,
	getComponentNames,
	getComponentProps,
	getComponentSlots,
	getElementAttrs,
	getNamedValueExports,
	getProjectValueExports,
	getTagType,
	getUnresolvedName,
	isRefAtOffset,
	isUnresolvedTag,
	toCheckedPositions,
} from './componentMeta';

type SourceFile = import('typescript-7/ast', { with: { 'resolution-mode': 'import' }}).SourceFile;
type Project = import('typescript-7/async', { with: { 'resolution-mode': 'import' }}).Project;

const directiveRE = /^v[A-Z]/;
const defaultImportRE = /\bimport\s+[\w$]+(?=\s*(?:,|from\b))/;
const scriptExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs'];

/** The extensions of the files that can export components: script modules and the files of `contentMappers`. */
export function getComponentModuleExtensions(contentMappers: unknown[] | undefined) {
	return [
		...scriptExtensions,
		...(contentMappers as { extensions?: string[] }[] | undefined)?.flatMap(entry => entry.extensions ?? []) ?? [],
	];
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
	/**
	 * The components that the modules of `fileName`'s project, other than external libraries, export. Cached per
	 * project for `fileName` until another file changes, so edits to `fileName` itself reuse the answer.
	 */
	getAutoImportComponents(fileName: string): Promise<AutoImportComponent[] | undefined>;
	/** The named value exports of the modules of `fileName`'s project, other than external libraries. Cached like `getAutoImportComponents`. */
	getAutoImportValues(fileName: string): Promise<AutoImportExport[] | undefined>;
	/** The TypeScript language server's edits that import `component` into `fileName` under `component.name`. */
	getComponentImportEdits(fileName: string, component: AutoImportComponent): Promise<readonly TextEdit[] | undefined>;
	/** The name of the identifier at `offset` in the source text of the Vue file `fileName`, when it resolves to nothing. */
	getUnresolvedName(fileName: string, offset: number): Promise<string | undefined>;
	/** Whether the tag name starting at `offset` in the source text of the Vue file `fileName` resolves to nothing. */
	isUnresolvedTag(fileName: string, offset: number): Promise<boolean | undefined>;
	/** The TypeScript language server's edits that import each named value export called `name` into `fileName`. */
	getNamedImportFixes(
		fileName: string,
		name: string,
	): Promise<{ fileName: string; edits: readonly TextEdit[] }[] | undefined>;
	/**
	 * The declaration, in another file, of the component whose tag name starts at `offset` in the source text of the
	 * Vue file `fileName`.
	 */
	getComponentDefinition(fileName: string, offset: number): Promise<DefinitionLocation | undefined>;
	/** The metadata of the component whose tag name starts at `offset` in the source text of the Vue file `fileName`. */
	getComponentMeta(fileName: string, offset: number): Promise<ComponentMeta | undefined>;
	/** The intrinsic element names available in the template of the Vue file `fileName`. */
	getElementNames(fileName: string): Promise<string[] | undefined>;
	/**
	 * The props of the component whose tag name starts at `offset` in the source text of the Vue file `fileName` or,
	 * given `expressionLength`, of the component that the expression of that length at `offset` evaluates to.
	 */
	getComponentProps(
		fileName: string,
		offset: number,
		expressionLength?: number,
	): Promise<ComponentPropInfo[] | undefined>;
	/** The names of the slots the Vue file `fileName` declares. */
	getComponentSlots(fileName: string, virtualCode: VueVirtualCode): Promise<string[] | undefined>;
	/**
	 * The attributes of the intrinsic element whose tag name starts at `offset` in the source text of the Vue file
	 * `fileName`, or else of the intrinsic element `tag`.
	 */
	getElementAttrs(fileName: string, offset: number | undefined, tag: string): Promise<ComponentPropInfo[] | undefined>;
	/** The component names available in the template of the Vue file `fileName`. */
	getComponentNames(fileName: string, virtualCode: VueVirtualCode): Promise<string[] | undefined>;
	/** The directive names (`vFoo`) available in the template of the Vue file `fileName`. */
	getComponentDirectives(fileName: string): Promise<string[] | undefined>;
	/** The template context properties that the code between `start` and `end` in the source text of the Vue file `fileName` reads. */
	collectExtractProps(fileName: string, start: number, end: number): Promise<ExtractPropsInfo[] | undefined>;
	/** Whether the identifier at `offset` in the source text of the Vue file `fileName` is a `Ref`. */
	isRefAtOffset(fileName: string, offset: number): Promise<boolean | undefined>;
	/** Whether TypeScript renames the code at `offset` in the source text of the Vue file `fileName`. */
	isRenamedAtOffset(fileName: string, offset: number): Promise<boolean | undefined>;
	/** Releases the file opened by `getProject`. */
	closeFile(fileName: string): void;
	/** Forgets the cached auto-import exports that a change to `fileName`, if it can export components, may affect. */
	fileChanged(fileName: string): void;
	/** Forgets the cached answers, e.g. after a config file changed. */
	invalidate(): void;
	dispose(): void;
}

/**
 * Asks the editor's TypeScript language server which project owns a file, over an API pipe the client opened.
 * `packageJsonPath` is the manifest of the TS 7 installation that server runs, so the client matches it.
 * `inferredContentMappers` are the content mappers the client registers for files outside any config.
 */
export async function connectTypeScriptProjectResolver(
	pipe: string,
	packageJsonPath: string,
	inferredContentMappers?: unknown[],
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
	/** Per project id, the auto-import exports, the file they were enumerated for and the extensions of the files they come from. */
	const autoImportExports = new Map<string, {
		fileName: string;
		extensions: string[];
		components: Promise<AutoImportComponent[]>;
		values: Promise<AutoImportExport[]>;
	}>();
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

	function getAutoImportExports(project: Project, fileName: string) {
		let cached = autoImportExports.get(project.id);
		// The requesting file's own exports may have changed since another file's enumeration.
		if (cached?.fileName !== fileName) {
			const exports = getProjectValueExports(ts, project.program, project.checker);
			cached = {
				fileName,
				extensions: getComponentModuleExtensions(
					project.configFileName
						? (project.parsedCommandLine.raw as { contentMappers?: unknown[] } | undefined)?.contentMappers
						: inferredContentMappers,
				),
				components: exports.then(entries => entries.filter(entry => entry.isComponent)),
				values: exports.then(entries => entries.filter(entry => entry.exportName !== 'default')),
			};
			autoImportExports.set(project.id, cached);
			exports.catch(() => autoImportExports.delete(project.id));
			cached.components.catch(() => {});
			cached.values.catch(() => {});
		}
		return cached;
	}

	function withSourceFile<T>(
		fileName: string,
		fn: (project: Project, sourceFile: SourceFile) => T | undefined | Promise<T | undefined>,
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
		getAutoImportComponents(fileName) {
			return withProject(fileName, project => getAutoImportExports(project, fileName).components);
		},
		getAutoImportValues(fileName) {
			return withProject(fileName, project => getAutoImportExports(project, fileName).values);
		},
		getComponentImportEdits(fileName, { name, fileName: moduleFileName, exportName }) {
			return withProject(fileName, async project => {
				const moduleSymbol = await project.checker.getSymbolOfSourceFile(moduleFileName);
				const symbol = moduleSymbol && await project.checker.getMemberInModuleExports(moduleSymbol, exportName);
				if (!symbol) {
					return;
				}
				// A template use site needs a value import.
				const edits = await project.languageService.getImportEditsForSymbols(fileName, [symbol], {
					isValidTypeOnlyUseSite: false,
				});
				return exportName === 'default'
					? edits.map(edit => ({ ...edit, newText: edit.newText.replace(defaultImportRE, `import ${name}`) }))
					: edits;
			});
		},
		getUnresolvedName(fileName, offset) {
			return withSourceFile(fileName, async (project, sourceFile) => {
				for (const position of toCheckedPositions(sourceFile, offset, ts.SpanMapFeature.Definition)) {
					const name = await getUnresolvedName(ts, project.checker, sourceFile, position);
					if (name) {
						return name;
					}
				}
			});
		},
		isUnresolvedTag(fileName, offset) {
			return withSourceFile(
				fileName,
				(project, sourceFile) => isUnresolvedTag(ts, project.checker, sourceFile, offset),
			);
		},
		getNamedImportFixes(fileName, name) {
			return withProject(fileName, async project => {
				const exports = await getNamedValueExports(ts, project.program, project.checker, name);
				return await Promise.all(exports.map(async ({ fileName: moduleFileName, symbol }) => ({
					fileName: moduleFileName,
					// A template use site needs a value import.
					edits: await project.languageService.getImportEditsForSymbols(fileName, [symbol], {
						isValidTypeOnlyUseSite: false,
					}),
				})));
			});
		},
		getComponentDefinition(fileName, offset) {
			return withSourceFile(
				fileName,
				(project, sourceFile) => getComponentDefinition(ts, project.checker, sourceFile, offset),
			);
		},
		getComponentMeta(fileName, offset) {
			return withSourceFile(fileName, async (project, sourceFile) => {
				const component = await getTagType(ts, project.checker, sourceFile, offset);
				return component && await getComponentMetaOfType(ts, project, component.type, component.node);
			});
		},
		getElementNames(fileName) {
			return withSourceFile(fileName, async (project, sourceFile) => {
				// A file-wide list with no source position, read by its generated name until the TypeScript protocol can
				// carry private data.
				const intrinsics = findVariable(ts, sourceFile, names.intrinsics);
				const type = intrinsics && await project.checker.getTypeAtLocation(intrinsics);
				return type && (await type.getProperties()).map(symbol => symbol.name);
			});
		},
		getComponentProps(fileName, offset, expressionLength) {
			return withSourceFile(
				fileName,
				(project, sourceFile) => getComponentProps(ts, project.checker, sourceFile, offset, expressionLength),
			);
		},
		getComponentSlots(fileName, virtualCode) {
			return withSourceFile(
				fileName,
				(project, sourceFile) => getComponentSlots(ts, project.checker, sourceFile, virtualCode),
			);
		},
		getElementAttrs(fileName, offset, tag) {
			return withSourceFile(
				fileName,
				(project, sourceFile) => getElementAttrs(ts, project.checker, sourceFile, offset, tag),
			);
		},
		getComponentNames(fileName, virtualCode) {
			return withSourceFile(
				fileName,
				(project, sourceFile) => getComponentNames(ts, project.checker, sourceFile, virtualCode),
			);
		},
		getComponentDirectives(fileName) {
			return withSourceFile(fileName, async (project, sourceFile) => {
				// A file-wide list with no source position, read by its generated name until the TypeScript protocol can
				// carry private data.
				const directives = findVariable(ts, sourceFile, names.directives);
				const type = directives && await project.checker.getTypeAtLocation(directives);
				return type && (await type.getProperties())
					.map(symbol => symbol.name)
					.filter(name => directiveRE.test(name));
			});
		},
		collectExtractProps(fileName, start, end) {
			return withSourceFile(
				fileName,
				(project, sourceFile) =>
					collectExtractProps(ts, project.checker, sourceFile, position => {
						const mapped = sourceFile.spanMap?.virtualToOriginalPositionForFeature(
							position,
							ts.SpanMapFeature.SemanticTokens,
						);
						return !!mapped
							&& mapped.fidelity !== ts.SpanMapFidelity.None
							&& mapped.position >= start
							&& mapped.position < end;
					}),
			);
		},
		isRefAtOffset(fileName, offset) {
			return withSourceFile(fileName, async (project, sourceFile) => {
				const [position] = toCheckedPositions(sourceFile, offset, ts.SpanMapFeature.Completion);
				return position !== undefined && await isRefAtOffset(ts, project.checker, sourceFile, position);
			});
		},
		isRenamedAtOffset(fileName, offset) {
			return withSourceFile(
				fileName,
				(_project, sourceFile) =>
					!!sourceFile.spanMap?.originalToVirtualPositions(offset, ts.SpanMapFeature.Rename).length,
			);
		},
		closeFile(fileName) {
			if (projects.delete(fileName)) {
				api.getCurrentLanguageServerSnapshot({ closeFiles: [fileName] }).then(snapshot => snapshot.dispose(), () => {});
			}
		},
		fileChanged(fileName) {
			for (const [id, { fileName: requester, extensions }] of autoImportExports) {
				if (requester !== fileName && extensions.some(extension => fileName.endsWith(extension))) {
					autoImportExports.delete(id);
				}
			}
		},
		invalidate() {
			projects.clear();
			autoImportExports.clear();
		},
		dispose() {
			projects.clear();
			autoImportExports.clear();
			api.close().catch(() => {});
		},
	};
}
