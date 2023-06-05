import * as vue from '@vue/language-core';
import * as vueTs from '@vue/typescript';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { URI } from 'vscode-uri';
import type { FileType } from '@volar/language-service';
import * as fs from 'fs';

const init: ts.server.PluginModuleFactory = (modules) => {
	const { typescript: ts } = modules;
	const externalFiles = new Map<ts.server.Project, string[]>();
	const pluginModule: ts.server.PluginModule = {
		create(info) {

			const projectName = info.project.getProjectName();

			if (!info.project.fileExists(projectName)) {
				// project name not a tsconfig path, this is a inferred project
				return info.languageService;
			}

			const parsed = vue.createParsedCommandLine(ts, ts.sys, projectName);
			const vueFileNames = parsed.fileNames.filter(fileName => fileName.endsWith('.vue'));
			if (!vueFileNames.length) {
				// no vue file
				return info.languageService;
			}

			externalFiles.set(info.project, vueFileNames);

			// fix: https://github.com/vuejs/language-tools/issues/205
			if (!(info.project as any).__vue_getScriptKind) {
				(info.project as any).__vue_getScriptKind = info.project.getScriptKind;
				info.project.getScriptKind = fileName => {
					if (fileName.endsWith('.vue')) {
						return ts.ScriptKind.Deferred;
					}
					return (info.project as any).__vue_getScriptKind(fileName);
				};
			}

			const vueTsLsHost: vue.TypeScriptLanguageHost = {
				getCompilationSettings: () => info.project.getCompilationSettings(),
				getCurrentDirectory: () => info.project.getCurrentDirectory(),
				getProjectVersion: () => info.project.getProjectVersion(),
				getProjectReferences: () => info.project.getProjectReferences(),
				getScriptFileNames: () => [
					...info.project.getScriptFileNames(),
					...vueFileNames,
				],
				getScriptSnapshot: (fileName) => info.project.getScriptSnapshot(fileName),
			};
			const uriToFileName = (uri: string) => URI.parse(uri).fsPath.replace(/\\/g, '/');
			const fileNameToUri = (fileName: string) => URI.file(fileName).toString();
			const vueTsLs = vueTs.createLanguageService(vueTsLsHost, parsed.vueOptions, ts, {
				uriToFileName,
				fileNameToUri,
				rootUri: URI.parse(fileNameToUri(vueTsLsHost.getCurrentDirectory())),
				fs: {
					stat(uri) {
						if (uri.startsWith('file://')) {
							const stats = fs.statSync(uriToFileName(uri), { throwIfNoEntry: false });
							if (stats) {
								return {
									type: stats.isFile() ? 1 satisfies FileType.File
										: stats.isDirectory() ? 2 satisfies FileType.Directory
											: stats.isSymbolicLink() ? 64 satisfies FileType.SymbolicLink
												: 0 satisfies FileType.Unknown,
									ctime: stats.ctimeMs,
									mtime: stats.mtimeMs,
									size: stats.size,
								};
							}
						}
					},
					readFile(uri, encoding) {
						if (uri.startsWith('file://')) {
							return fs.readFileSync(uriToFileName(uri), { encoding: encoding as 'utf-8' ?? 'utf-8' });
						}
					},
					readDirectory(uri) {
						if (uri.startsWith('file://')) {
							const dirName = uriToFileName(uri);
							const files = fs.existsSync(dirName) ? fs.readdirSync(dirName, { withFileTypes: true }) : [];
							return files.map<[string, FileType]>(file => {
								return [file.name, file.isFile() ? 1 satisfies FileType.File
									: file.isDirectory() ? 2 satisfies FileType.Directory
										: file.isSymbolicLink() ? 64 satisfies FileType.SymbolicLink
											: 0 satisfies FileType.Unknown];
							});
						}
						return [];
					},
				},
			});

			return new Proxy(info.languageService, {
				get: (target: any, property: keyof ts.LanguageService) => {
					if (
						property === 'getSemanticDiagnostics'
						|| property === 'getEncodedSemanticClassifications'
						|| property === 'getCompletionsAtPosition'
						|| property === 'getCompletionEntryDetails'
						|| property === 'getCompletionEntrySymbol'
						|| property === 'getQuickInfoAtPosition'
						|| property === 'getSignatureHelpItems'
						|| property === 'getRenameInfo'
						|| property === 'findRenameLocations'
						|| property === 'getDefinitionAtPosition'
						|| property === 'getDefinitionAndBoundSpan'
						|| property === 'getTypeDefinitionAtPosition'
						|| property === 'getImplementationAtPosition'
						|| property === 'getReferencesAtPosition'
						|| property === 'findReferences'
					) {
						return vueTsLs[property];
					}
					return target[property];
				},
			});
		},
		getExternalFiles(project) {
			return externalFiles.get(project) ?? [];
		},
	};
	return pluginModule;
};

export = init;
