import { resolveConfig } from '../..';
import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { URI } from 'vscode-uri';
import { FileType, TypeScriptLanguageHost, createLanguageService } from '@volar/language-service';

const uriToFileName = (uri: string) => URI.parse(uri).fsPath.replace(/\\/g, '/');
const fileNameToUri = (fileName: string) => URI.file(fileName).toString();
const testRoot = path.resolve(__dirname, '../../../vue-test-workspace');

export const rootUri = URI.file(testRoot);
export const tester = createTester(testRoot);

function createTester(root: string) {

	const parseConfigHost: ts.ParseConfigHost = {
		...ts.sys,
		readDirectory: (path, extensions, exclude, include, depth) => {
			return ts.sys.readDirectory(path, [...extensions, '.vue'], exclude, include, depth);
		},
	};

	const realTsConfig = path.join(root, 'tsconfig.json').replace(/\\/g, '/');
	const config = ts.readJsonConfigFile(realTsConfig, ts.sys.readFile);
	const parsedCommandLine = ts.parseJsonSourceFileConfigFileContent(config, parseConfigHost, path.dirname(realTsConfig), {}, realTsConfig);
	parsedCommandLine.fileNames = parsedCommandLine.fileNames.map(fileName => fileName.replace(/\\/g, '/'));
	const scriptSnapshots = new Map<string, ts.IScriptSnapshot>();
	const host: TypeScriptLanguageHost = {
		getProjectVersion: () => 0,
		getScriptFileNames: () => parsedCommandLine.fileNames,
		getCurrentDirectory: () => root,
		getCompilationSettings: () => parsedCommandLine.options,
		getScriptVersion: () => {
			return undefined;
		},
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
							return [file.name, file.isFile() ? FileType.File
								: file.isDirectory() ? FileType.Directory
									: file.isSymbolicLink() ? FileType.SymbolicLink
										: FileType.Unknown];
						});
					}
					return [];
				},
			}
		},
		resolveConfig({}),
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
