import * as ts from 'typescript/lib/tsserverlibrary';
import * as vue from '@volar/vue-typescript';
import * as apis from './apis';
import { createTypeScriptRuntime, TypeScriptRuntime } from '@volar/vue-typescript';
import { tsShared } from '@volar/vue-typescript';

let projectVersion = 0;

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

	projectVersion++;

	const host = options.host;
	const vueCompilerOptions = getVueCompilerOptions();
	const scripts = new Map<string, {
		projectVersion: number,
		modifiedTime: number,
		scriptSnapshot: ts.IScriptSnapshot,
		version: string,
	}>();
	const vueLsHost: vue.LanguageServiceHost = {
		...host,
		resolveModuleNames: undefined, // avoid failed with tsc built-in fileExists
		writeFile: (fileName, content) => {
			if (fileName.indexOf('__VLS_') === -1) {
				host.writeFile(fileName, content, false);
			}
		},
		getCompilationSettings: () => options.options,
		getVueCompilationSettings: () => vueCompilerOptions,
		getScriptFileNames: () => {
			return options.rootNames as string[];
		},
		getScriptVersion,
		getScriptSnapshot,
		getProjectVersion: () => {
			return projectVersion.toString();
		},
		getVueProjectVersion: () => {
			return projectVersion.toString();
		},
		getProjectReferences: () => options.projectReferences,
	};

	const tsRuntime: TypeScriptRuntime = (options.oldProgram as any)?.__VLS_tsRuntime ?? createTypeScriptRuntime({
		typescript: ts,
		baseCssModuleType: 'any',
		getCssClasses: () => ({}),
		vueCompilerOptions,
		vueLsHost: vueLsHost,
		isVueTsc: true,
	});
	tsRuntime.update(); // must update before getProgram() to update virtual scripts

	const tsProgram = tsRuntime.getTsLs().getProgram();
	if (!tsProgram)
		throw '!tsProgram';

	const proxyApis = apis.register(ts, tsRuntime);
	const program = new Proxy<ts.Program>(tsProgram, {
		get: (target: any, property: keyof typeof proxyApis) => {
			tsRuntime.update();
			return proxyApis[property] || target[property];
		},
	});

	(program as any).__VLS_tsRuntime = tsRuntime;

	for (const rootName of options.rootNames) {
		// register file watchers
		host.getSourceFile(rootName, ts.ScriptTarget.ESNext);
	}

	return program;

	function getVueCompilerOptions(): vue.VueCompilerOptions {
		const tsConfig = options.options.configFilePath;
		if (typeof tsConfig === 'string') {
			return tsShared.createParsedCommandLine(ts, ts.sys, tsConfig).vueOptions;
		}
		return {};
	}
	function getScriptVersion(fileName: string) {
		return getScript(fileName)?.version ?? '';
	}
	function getScriptSnapshot(fileName: string) {
		return getScript(fileName)?.scriptSnapshot;
	}
	function getScript(fileName: string) {

		const script = scripts.get(fileName);
		if (script?.projectVersion === projectVersion) {
			return script;
		}

		const modifiedTime = ts.sys.getModifiedTime?.(fileName)?.valueOf() ?? 0;
		if (script?.modifiedTime === modifiedTime) {
			return script;
		}

		if (host.fileExists(fileName)) {
			const fileContent = host.readFile(fileName);
			if (fileContent !== undefined) {
				const script = {
					projectVersion,
					modifiedTime,
					scriptSnapshot: ts.ScriptSnapshot.fromString(fileContent),
					version: host.createHash?.(fileContent) ?? fileContent,
				};
				scripts.set(fileName, script);
				return script;
			}
		}
	}
}

function doThrow(msg: string) {
	console.error(msg);
	throw msg;
}
