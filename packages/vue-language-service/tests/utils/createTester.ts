import { resolveConfig, VueLanguageServiceHost } from '../..';
import * as ts from 'typescript/lib/tsserverlibrary';
import * as path from 'path';
import { URI } from 'vscode-uri';
import { createLanguageService } from '@volar/language-service';

const testRoot = path.resolve(__dirname, '../../../vue-test-workspace');
export const rootUri = URI.file(testRoot);
export const tester = createTester(testRoot);

const uriToFileName = (uri: string) => URI.parse(uri).fsPath.replace(/\\/g, '/');
const fileNameToUri = (fileName: string) => URI.file(fileName).toString();

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
	const host: VueLanguageServiceHost = {
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
		getVueCompilationSettings: () => ({}),
		getTypeScriptModule: () => ts,
	};
	const defaultVSCodeSettings: any = {
		'typescript.preferences.quoteStyle': 'single',
		'javascript.preferences.quoteStyle': 'single',
	};
	let currentVSCodeSettings: any;
	const languageServiceConfig = resolveConfig({}, ts, {}, {});
	const languageService = createLanguageService({
		host,
		config: languageServiceConfig,
		uriToFileName,
		fileNameToUri,
		rootUri,
		configurationHost: {
			async getConfiguration(section: string) {
				const settings = currentVSCodeSettings ?? defaultVSCodeSettings;
				return settings[section];
			},
			onDidChangeConfiguration() { },
		},
		documentContext: {
			resolveReference: (ref, _base) => {
				return ref;
			},
		},
	});

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
