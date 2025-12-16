import { createLanguageServiceHost, resolveFileLanguageId, type TypeScriptProjectHost } from '@volar/typescript';
import * as core from '@vue/language-core';
import type * as ts from 'typescript';
import { getComponentMeta } from './componentMeta';
import type { MetaCheckerOptions } from './types';

export function createCheckerBase(
	ts: typeof import('typescript'),
	getConfigAndFiles: () => [
		commandLine: core.ParsedCommandLine,
		fileNames: string[],
	],
	checkerOptions: MetaCheckerOptions,
	rootPath: string,
) {
	let [{ vueOptions, options, projectReferences }, fileNames] = getConfigAndFiles();
	/**
	 * Used to lookup if a file is referenced.
	 */
	let fileNamesSet = new Set(fileNames.map(path => path.replace(/\\/g, '/')));
	let projectVersion = 0;

	const projectHost: TypeScriptProjectHost = {
		getCurrentDirectory: () => rootPath,
		getProjectVersion: () => projectVersion.toString(),
		getCompilationSettings: () => options,
		getScriptFileNames: () => [...fileNamesSet],
		getProjectReferences: () => projectReferences,
	};
	const scriptSnapshots = new Map<string, ts.IScriptSnapshot | undefined>();
	const vueLanguagePlugin = core.createVueLanguagePlugin<string>(
		ts,
		projectHost.getCompilationSettings(),
		vueOptions,
		id => id,
	);
	const language = core.createLanguage(
		[
			vueLanguagePlugin,
			{
				getLanguageId(fileName) {
					return resolveFileLanguageId(fileName);
				},
			},
		],
		new core.FileMap(ts.sys.useCaseSensitiveFileNames),
		fileName => {
			let snapshot = scriptSnapshots.get(fileName);

			if (!scriptSnapshots.has(fileName)) {
				const fileText = ts.sys.readFile(fileName);
				if (fileText !== undefined) {
					scriptSnapshots.set(fileName, ts.ScriptSnapshot.fromString(fileText));
				}
				else {
					scriptSnapshots.set(fileName, undefined);
				}
			}
			snapshot = scriptSnapshots.get(fileName);

			if (snapshot) {
				language.scripts.set(fileName, snapshot);
			}
			else {
				language.scripts.delete(fileName);
			}
		},
	);
	const { languageServiceHost } = createLanguageServiceHost(ts, ts.sys, language, s => s, projectHost);
	const tsLs = ts.createLanguageService(languageServiceHost);
	const printer = ts.createPrinter(checkerOptions.printer);

	if (checkerOptions.forceUseTs) {
		const getScriptKind = languageServiceHost.getScriptKind?.bind(languageServiceHost);
		languageServiceHost.getScriptKind = fileName => {
			const scriptKind = getScriptKind!(fileName);
			if (vueOptions.extensions.some(ext => fileName.endsWith(ext))) {
				if (scriptKind === ts.ScriptKind.JS) {
					return ts.ScriptKind.TS;
				}
				if (scriptKind === ts.ScriptKind.JSX) {
					return ts.ScriptKind.TSX;
				}
			}
			return scriptKind;
		};
	}

	return {
		getExportNames,
		getComponentMeta(fileName: string, exportName = 'default') {
			fileName = fileName.replace(/\\/g, '/');
			const [program, sourceFile] = getProgramAndFile(fileName);
			const componentNode = getExport(ts, program, sourceFile, exportName)!;
			if (!componentNode) {
				throw new Error(`Export '${exportName}' not found in '${sourceFile.fileName}'.`);
			}
			return getComponentMeta(
				ts,
				program,
				printer,
				vueOptions,
				language,
				sourceFile,
				componentNode,
				checkerOptions,
			);
		},
		updateFile(fileName: string, text: string) {
			fileName = fileName.replace(/\\/g, '/');
			scriptSnapshots.set(fileName, ts.ScriptSnapshot.fromString(text));
			// Ensure the file is referenced
			fileNamesSet.add(fileName);
			projectVersion++;
		},
		deleteFile(fileName: string) {
			fileName = fileName.replace(/\\/g, '/');
			fileNamesSet.delete(fileName);
			projectVersion++;
		},
		reload() {
			[{ vueOptions, options, projectReferences }, fileNames] = getConfigAndFiles();
			fileNamesSet = new Set(fileNames.map(path => path.replace(/\\/g, '/')));
			this.clearCache();
		},
		clearCache() {
			scriptSnapshots.clear();
			projectVersion++;
		},
		getProgram() {
			return tsLs.getProgram();
		},
	};

	function getProgramAndFile(componentPath: string) {
		let program = tsLs.getProgram()!;
		let sourceFile = program.getSourceFile(componentPath);
		if (!sourceFile) {
			fileNamesSet.add(componentPath);
			projectVersion++;
			program = tsLs.getProgram()!;
			sourceFile = program.getSourceFile(componentPath)!;
		}
		return [program, sourceFile] as const;
	}

	function getExportNames(componentPath: string) {
		const [program, sourceFile] = getProgramAndFile(componentPath);
		return getExports(program, sourceFile).map(e => e.getName());
	}
}

function getExport(
	ts: typeof import('typescript'),
	program: ts.Program,
	sourceFile: ts.SourceFile,
	exportName: string,
) {
	const exports = getExports(program, sourceFile);
	const symbol = exports.find(e => e.getName() === exportName);
	if (symbol?.valueDeclaration) {
		const decl = symbol.valueDeclaration;
		if (ts.isExportAssignment(decl)) {
			return decl.expression;
		}
		if (ts.isVariableDeclaration(decl)) {
			return decl.initializer;
		}
	}
}

function getExports(program: ts.Program, sourceFile: ts.SourceFile) {
	const typeChecker = program.getTypeChecker();
	const moduleSymbol = typeChecker.getSymbolAtLocation(sourceFile);
	return moduleSymbol ? typeChecker.getExportsOfModule(moduleSymbol) : [];
}
