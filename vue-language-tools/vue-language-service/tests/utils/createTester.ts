import { createLanguageService, VueLanguageServiceHost } from '../..';
import * as ts from 'typescript/lib/tsserverlibrary';
import * as path from 'path';
import * as shared from '@volar/shared';
import { URI } from 'vscode-uri';

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

	const realTsConfig = shared.normalizeFileName(path.join(root, 'tsconfig.json'));
	const config = ts.readJsonConfigFile(realTsConfig, ts.sys.readFile);
	const parsedCommandLine = ts.parseJsonSourceFileConfigFileContent(config, parseConfigHost, path.dirname(realTsConfig), {}, realTsConfig);
	parsedCommandLine.fileNames = parsedCommandLine.fileNames.map(shared.normalizeFileName);
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
	const vscodeSettings: any = {
		typescript: {
			preferences: {
				quoteStyle: 'single',
			},
		},
		javascript: {
			preferences: {
				quoteStyle: 'single',
			},
		},
	};
	const languageService = createLanguageService(
		host,
		{
			rootUri,
			configurationHost: {
				async getConfiguration(section: string) {
					const keys = section.split('.');
					let settings = vscodeSettings;
					for (const key of keys) {
						if (key in settings) {
							settings = settings[key];
						}
						else {
							settings = undefined;
							break;
						}
					}
					return settings;
				},
				onDidChangeConfiguration() { },
			}
		});

	return {
		host,
		languageService,
	};

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
