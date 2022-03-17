import * as ts from 'typescript/lib/tsserverlibrary';
import * as vue from '@volar/vue-typescript';
import * as shared from '@volar/shared';
import * as apis from './apis';
import { createTypeScriptRuntime } from '@volar/vue-typescript';

export function createProgramProxy(
	options: ts.CreateProgramOptions, // rootNamesOrOptions: readonly string[] | CreateProgramOptions,
	_options?: ts.CompilerOptions,
	_host?: ts.CompilerHost,
	_oldProgram?: ts.Program,
	_configFileParsingDiagnostics?: readonly ts.Diagnostic[],
) {

	if (!options.options.noEmit && !options.options.emitDeclarationOnly)
		return doThrow('js emit is not support');

	if (!options.host)
		return doThrow('!options.host');

	const host = options.host;
	const vueCompilerOptions = getVueCompilerOptions();
	const scripts = new Map<string, {
		scriptSnapshot: ts.IScriptSnapshot,
		version: string,
	}>();
	const vueLsHost: vue.LanguageServiceHost = {
		...host,
		resolveModuleNames: undefined, // avoid failed with tsc built-in fileExists
		writeFile: undefined,
		getCompilationSettings: () => options.options,
		getVueCompilationSettings: () => vueCompilerOptions,
		getScriptFileNames: () => options.rootNames as string[],
		getScriptVersion: (fileName) => scripts.get(fileName)?.version ?? '',
		getScriptSnapshot,
		getProjectVersion: () => '',
		getVueProjectVersion: () => '',
		getProjectReferences: () => options.projectReferences,
	};
	const tsRuntime = createTypeScriptRuntime({
		typescript: ts,
		getCssClasses: () => ({}),
		getCssVBindRanges: () => [],
		vueCompilerOptions,
		vueLsHost: vueLsHost,
		isTsPlugin: false,
	});
	const tsProgram = tsRuntime.getTsLs('script').getProgram();
	if (!tsProgram) throw '!tsProgram';

	const tsProgramApis_2 = apis.register(ts, tsRuntime);
	const tsProgramProxy = new Proxy<ts.Program>(tsProgram, {
		get: (target: any, property: keyof typeof tsProgramApis_2) => {
			tsRuntime.update(true);
			return tsProgramApis_2[property] || target[property];
		},
	});

	for (const rootName of options.rootNames) {
		// register file watchers
		host.getSourceFile(rootName, ts.ScriptTarget.ESNext);
	}

	return tsProgramProxy;

	function getVueCompilerOptions(): vue.VueCompilerOptions {
		const tsConfig = options.options.configFilePath;
		if (typeof tsConfig === 'string') {
			return shared.createParsedCommandLine(ts, ts.sys, tsConfig).vueOptions;
		}
		return {};
	}
	function getScriptSnapshot(fileName: string) {
		const script = scripts.get(fileName);
		if (script) {
			return script.scriptSnapshot;
		}
		if (host.fileExists(fileName)) {
			const fileContent = host.readFile(fileName);
			if (fileContent !== undefined) {
				const scriptSnapshot = ts.ScriptSnapshot.fromString(fileContent);
				scripts.set(fileName, {
					scriptSnapshot: scriptSnapshot,
					version: ts.sys.createHash?.(fileContent) ?? fileContent,
				});
				return scriptSnapshot;
			}
		}
	}
}

function doThrow(msg: string) {
	console.error(msg);
	throw msg;
}
