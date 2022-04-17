import { createLanguageService, LanguageServiceHost } from '../..';
import * as ts from 'typescript/lib/tsserverlibrary';
import * as path from 'upath';

const testRoot = path.resolve(__dirname, '../../testCases');
export const tester = createTester(testRoot);

function createTester(root: string) {

	const parseConfigHost: ts.ParseConfigHost = {
		...ts.sys,
		readDirectory: (path, extensions, exclude, include, depth) => {
			return ts.sys.readDirectory(path, [...extensions, '.vue'], exclude, include, depth);
		},
	};

	const realTsConfig = path.join(root, 'tsconfig.json');
	const config = ts.readJsonConfigFile(realTsConfig, ts.sys.readFile);
	const parsedCommandLine = ts.parseJsonSourceFileConfigFileContent(config, parseConfigHost, path.dirname(realTsConfig), {}, path.basename(realTsConfig));

	let projectVersion = 0;
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
		getProjectVersion: () => projectVersion.toString(),
		getScriptFileNames: () => parsedCommandLine.fileNames,
		getCurrentDirectory: () => root,
		getCompilationSettings: () => parsedCommandLine.options,
		getScriptVersion,
		getScriptSnapshot,
		getVueCompilationSettings: () => ({}),
	}
	const languageService = createLanguageService({ typescript: ts }, host, undefined, undefined, undefined, []);

	return {
		host,
		languageService,
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
