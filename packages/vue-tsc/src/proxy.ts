import * as ts from 'typescript/lib/tsserverlibrary';
import * as vue from 'vscode-vue-languageservice';
import * as path from 'path';

export function createProgramProxy(options: ts.CreateProgramOptions) {

	if (!options.options.noEmit)
		throw 'emit mode is not yet support';

	if (!options.host)
		throw '!options.host';

	if (!options.host.realpath)
		throw '!options.host.realpath';

	if (!options.host.readDirectory)
		throw '!options.host.readDirectory';

	const host = options.host;
	const realpath = options.host.realpath;
	const readDirectory = options.host.readDirectory;
	const parseConfigHost: ts.ParseConfigHost = {
		useCaseSensitiveFileNames: host.useCaseSensitiveFileNames(),
		readDirectory: (path, extensions, exclude, include, depth) => {
			return readDirectory(path, ['.vue'], exclude, include, depth);
		},
		fileExists: fileName => host.fileExists(fileName),
		readFile: fileName => host.readFile(fileName),
	};

	const fileNames = [
		...options.rootNames.map(rootName => realpath(rootName)),
		...getVueFileNames(),
	];
	const scriptSnapshots = new Map<string, ts.IScriptSnapshot>();
	const vueLsHost: vue.LanguageServiceHost = {
		...host,
		writeFile: undefined,
		getCompilationSettings: () => options.options,
		getScriptFileNames: () => fileNames,
		getScriptVersion: () => '',
		getScriptSnapshot,
		getProjectVersion: () => '',
	};
	const vueLs = vue.createLanguageService({ typescript: ts }, vueLsHost);
	const program = vueLs.__internal__.tsProgramProxy;

	return program;

	function getVueFileNames() {
		const tsConfig = options.options.configFilePath;
		if (typeof tsConfig === 'string') {
			const tsConfigFile = ts.readJsonConfigFile(tsConfig, host.readFile);
			const { fileNames } = ts.parseJsonSourceFileConfigFileContent(tsConfigFile, parseConfigHost, path.dirname(tsConfig), options.options, path.basename(tsConfig));
			return fileNames;
		}
		return [];
	}
	function getScriptSnapshot(fileName: string) {
		const scriptSnapshot = scriptSnapshots.get(fileName);
		if (scriptSnapshot) {
			return scriptSnapshot;
		}
		if (host.fileExists(fileName)) {
			const fileContent = host.readFile(fileName);
			if (fileContent !== undefined) {
				const scriptSnapshot = ts.ScriptSnapshot.fromString(fileContent);
				scriptSnapshots.set(fileName, scriptSnapshot);
				return scriptSnapshot;
			}
		}
	}
}
