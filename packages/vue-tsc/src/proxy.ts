import * as ts from 'typescript/lib/tsserverlibrary';
import * as vue from '@volar/vue-typescript';
import * as path from 'path';
import * as shared from '@volar/shared';
import * as apis from './apis';
import { createTypeScriptRuntime } from '@volar/vue-typescript';

export function createProgramProxy(options: ts.CreateProgramOptions) {

	if (!options.options.noEmit && !options.options.emitDeclarationOnly)
		return doThrow('js emit is not support');

	if (!options.host)
		return doThrow('!options.host');

	if (!options.host.readDirectory)
		return doThrow('!options.host.readDirectory');

	const host = options.host;
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
		...options.rootNames,
		...getVueFileNames(),
	];
	const vueCompilerOptions = getVueCompilerOptions();
	const scriptSnapshots = new Map<string, ts.IScriptSnapshot>();
	const vueLsHost: vue.LanguageServiceHostBase = {
		...host,
		writeFile: undefined,
		getCompilationSettings: () => options.options,
		getVueCompilationSettings: () => vueCompilerOptions,
		getScriptFileNames: () => fileNames,
		getScriptVersion: () => '',
		getScriptSnapshot,
		getProjectVersion: () => '',
		getVueProjectVersion: () => '',
		getProjectReferences: () => options.projectReferences,
	};
	const tsRuntime = createTypeScriptRuntime({ typescript: ts }, vueLsHost, true);
	const tsProgram = tsRuntime.context.scriptTsLsRaw.getProgram(); // TODO: handle template ls?
	if (!tsProgram) throw '!tsProgram';

	const tsProgramApis_2 = apis.register(tsRuntime.context);
	const tsProgramApis_3: Partial<typeof tsProgram> = {
		emit: tsRuntime.apiHook(tsProgramApis_2.emit),
		getRootFileNames: tsRuntime.apiHook(tsProgramApis_2.getRootFileNames),
		getSemanticDiagnostics: tsRuntime.apiHook(tsProgramApis_2.getSemanticDiagnostics),
		getSyntacticDiagnostics: tsRuntime.apiHook(tsProgramApis_2.getSyntacticDiagnostics),
		getGlobalDiagnostics: tsRuntime.apiHook(tsProgramApis_2.getGlobalDiagnostics),
	};
	const tsProgramProxy = new Proxy<ts.Program>(tsProgram, {
		get: (target: any, property: keyof typeof tsProgram) => {
			return tsProgramApis_3[property] || target[property];
		},
	});

	return tsProgramProxy;

	function getVueFileNames() {
		const tsConfig = options.options.configFilePath;
		if (typeof tsConfig === 'string') {
			const tsConfigFile = ts.readJsonConfigFile(tsConfig, host.readFile);
			const { fileNames } = ts.parseJsonSourceFileConfigFileContent(tsConfigFile, parseConfigHost, path.dirname(tsConfig), options.options, path.basename(tsConfig));
			return fileNames;
		}
		return [];
	}
	function getVueCompilerOptions(): vue.VueCompilerOptions {
		const tsConfig = options.options.configFilePath;
		if (typeof tsConfig === 'string') {
			return shared.createParsedCommandLine(ts, ts.sys, tsConfig).vueOptions;
		}
		return {};
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

function doThrow(msg: string) {
	console.error(msg);
	throw msg;
}
