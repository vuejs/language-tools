import { FileType, TypeScriptLanguageHost, createLanguageService } from '@volar/language-service';
import * as fs from 'fs';
import * as path from 'path';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { URI } from 'vscode-uri';
import { resolveConfig } from '../../out';

const uriToFileName = (uri: string) => URI.parse(uri).fsPath.replace(/\\/g, '/');
const fileNameToUri = (fileName: string) => URI.file(fileName).toString();
const testRoot = path.resolve(__dirname, '../../../../test-workspace/language-service').replace(/\\/g, '/');

export const rootUri = URI.file(testRoot);
export const tester = createTester(testRoot);

function createTester(root: string) {

	const ts = require('typescript') as typeof import('typescript/lib/tsserverlibrary');
	const realTsConfig = path.join(root, 'tsconfig.json').replace(/\\/g, '/');
	const config = ts.readJsonConfigFile(realTsConfig, ts.sys.readFile);
	const parsedCommandLine = ts.parseJsonSourceFileConfigFileContent(config, ts.sys, path.dirname(realTsConfig), {}, realTsConfig, undefined, [{ extension: 'vue', isMixedContent: true, scriptKind: ts.ScriptKind.Deferred }]);
	parsedCommandLine.fileNames = parsedCommandLine.fileNames.map(fileName => fileName.replace(/\\/g, '/'));
	const scriptSnapshots = new Map<string, ts.IScriptSnapshot>();
	const host: TypeScriptLanguageHost = {
		workspacePath: root,
		rootPath: root,
		getProjectVersion: () => '0',
		getScriptFileNames: () => parsedCommandLine.fileNames,
		getCompilationSettings: () => parsedCommandLine.options,
		getScriptSnapshot,
	};
	const defaultVSCodeSettings: any = {
		'typescript.preferences.quoteStyle': 'single',
		'javascript.preferences.quoteStyle': 'single',
	};
	let currentVSCodeSettings: any;
	const languageService = createLanguageService(
		{ typescript: ts as any },
		{
			workspaceUri: rootUri,
			rootUri,
			uriToFileName,
			fileNameToUri,
			async getConfiguration(section: string) {
				const settings = currentVSCodeSettings ?? defaultVSCodeSettings;
				if (settings[section]) {
					return settings[section];
				}
				let result: Record<string, any> | undefined;
				for (const key in settings) {
					if (key.startsWith(section + '.')) {
						const newKey = key.slice(section.length + 1);
						result ??= {};
						result[newKey] = settings[key];
					}
				}
				return result;
			},
			fs: {
				stat(uri) {
					if (uri.startsWith('file://')) {
						try {
							const stats = fs.statSync(uriToFileName(uri), { throwIfNoEntry: false });
							if (stats) {
								return {
									type: stats.isFile() ? FileType.File
										: stats.isDirectory() ? FileType.Directory
											: stats.isSymbolicLink() ? FileType.SymbolicLink
												: FileType.Unknown,
									ctime: stats.ctimeMs,
									mtime: stats.mtimeMs,
									size: stats.size,
								};
							}
						}
						catch {
							return undefined;
						}
					}
				},
				readFile(uri, encoding) {
					if (uri.startsWith('file://')) {
						try {
							return fs.readFileSync(uriToFileName(uri), { encoding: encoding as 'utf-8' ?? 'utf-8' });
						}
						catch {
							return undefined;
						}
					}
				},
				readDirectory(uri) {
					if (uri.startsWith('file://')) {
						try {
							const dirName = uriToFileName(uri);
							const files = fs.readdirSync(dirName, { withFileTypes: true });
							return files.map<[string, FileType]>(file => {
								return [file.name, file.isFile() ? FileType.File
									: file.isDirectory() ? FileType.Directory
										: file.isSymbolicLink() ? FileType.SymbolicLink
											: FileType.Unknown];
							});
						}
						catch {
							return [];
						}
					}
					return [];
				},
			}
		},
		resolveConfig(ts, {}),
		host,
	);

	return {
		uriToFileName,
		fileNameToUri,
		host,
		languageService,
		setVSCodeSettings,
	};

	function setVSCodeSettings(settings: any = undefined) {
		currentVSCodeSettings = settings;
	}
	function getScriptSnapshot(fileName: string) {
		const snapshot = scriptSnapshots.get(fileName);
		if (snapshot) {
			return snapshot;
		}
		const text = getScriptText(fileName);
		if (text !== undefined) {
			const snapshot = ts.ScriptSnapshot.fromString(text);
			scriptSnapshots.set(fileName, snapshot);
			return snapshot;
		}
	}
	function getScriptText(fileName: string) {
		if (ts.sys.fileExists(fileName)) {
			return ts.sys.readFile(fileName, 'utf8');
		}
	}
}
