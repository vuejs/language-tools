import { resolveConfig, LanguageServiceHost } from '../..';
import * as ts from 'typescript';
import * as path from 'path';
import { URI } from 'vscode-uri';
import { createLanguageService } from '@volar/language-service';

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
	const scriptVersions = new Map<string, string>();
	const scriptSnapshots = new Map<string, [string, ts.IScriptSnapshot]>();
	const host: LanguageServiceHost = {
		// ts
		getNewLine: () => ts.sys.newLine,
		useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
		readFile: ts.sys.readFile,
		writeFile: ts.sys.writeFile,
		fileExists: ts.sys.fileExists,
		directoryExists: ts.sys.directoryExists,
		getDirectories: ts.sys.getDirectories,
		readDirectory: ts.sys.readDirectory,
		realpath: ts.sys.realpath,
		// custom
		getDefaultLibFileName: options => ts.getDefaultLibFilePath(options),
		getProjectVersion: () => '0',
		getScriptFileNames: () => parsedCommandLine.fileNames,
		getCurrentDirectory: () => root,
		getCompilationSettings: () => parsedCommandLine.options,
		getScriptVersion,
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
			onDidChangeConfiguration() { },
			documentContext: {
				resolveReference: (ref, _base) => {
					return ref;
				},
			},
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
	function getScriptVersion(fileName: string) {
		return scriptVersions.get(fileName) ?? '';
	}
	function getScriptSnapshot(fileName: string) {
		const version = getScriptVersion(fileName);
		const cache = scriptSnapshots.get(fileName);
		if (cache && cache[0] === version) {
			return cache[1];
		}
		const text = getScriptText(fileName);
		if (text !== undefined) {
			const snapshot = ts.ScriptSnapshot.fromString(text);
			scriptSnapshots.set(fileName, [version.toString(), snapshot]);
			return snapshot;
		}
	}
	function getScriptText(fileName: string) {
		if (ts.sys.fileExists(fileName)) {
			return ts.sys.readFile(fileName, 'utf8');
		}
	}
}
