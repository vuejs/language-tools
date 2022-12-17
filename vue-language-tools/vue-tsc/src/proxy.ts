import * as ts from 'typescript/lib/tsserverlibrary';
import * as vue from '@volar/vue-language-core';
import * as vueTs from '@volar/vue-typescript';

export function createProgramProxy(
	options: ts.CreateProgramOptions, // rootNamesOrOptions: readonly string[] | CreateProgramOptions,
	_options?: ts.CompilerOptions,
	_host?: ts.CompilerHost,
	_oldProgram?: ts.Program,
	_configFileParsingDiagnostics?: readonly ts.Diagnostic[],
) {

	if (!options.options.noEmit && !options.options.emitDeclarationOnly)
		return doThrow('js emit is not supported');

	if (!options.options.noEmit && options.options.noEmitOnError)
		return doThrow('noEmitOnError is not supported');

	if (!options.host)
		return doThrow('!options.host');

	let program = options.oldProgram as any;

	if (!program) {

		const ctx = {
			projectVersion: 0,
			options,
			get languageServiceHost() {
				return vueLsHost;
			},
		};
		const vueCompilerOptions = getVueCompilerOptions();
		const scripts = new Map<string, {
			projectVersion: number,
			modifiedTime: number,
			scriptSnapshot: ts.IScriptSnapshot,
			version: string,
		}>();
		const vueLsHost = new Proxy(<vue.LanguageServiceHost>{
			resolveModuleNames: undefined, // avoid failed with tsc built-in fileExists
			writeFile: (fileName, content) => {
				if (fileName.indexOf('__VLS_') === -1) {
					ctx.options.host!.writeFile(fileName, content, false);
				}
			},
			getCompilationSettings: () => ctx.options.options,
			getVueCompilationSettings: () => vueCompilerOptions,
			getScriptFileNames: () => {
				return ctx.options.rootNames as string[];
			},
			getScriptVersion,
			getScriptSnapshot,
			getProjectVersion: () => {
				return ctx.projectVersion.toString();
			},
			getProjectReferences: () => ctx.options.projectReferences,

			getTypeScriptModule: () => ts,
			isTsc: true,
		}, {
			get: (target, property) => {
				if (property in target) {
					return target[property as keyof vue.LanguageServiceHost];
				}
				return ctx.options.host![property as keyof ts.CompilerHost];
			},
		});
		const vueTsLs = vueTs.createLanguageService(vueLsHost);

		program = vueTsLs.getProgram();
		program.__vue = ctx;

		function getVueCompilerOptions(): vue.VueCompilerOptions {
			const tsConfig = ctx.options.options.configFilePath;
			if (typeof tsConfig === 'string') {
				return vue.createParsedCommandLine(ts, ts.sys, tsConfig, []).vueOptions;
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
			if (script?.projectVersion === ctx.projectVersion) {
				return script;
			}

			const modifiedTime = ts.sys.getModifiedTime?.(fileName)?.valueOf() ?? 0;
			if (script?.modifiedTime === modifiedTime) {
				return script;
			}

			if (ctx.options.host!.fileExists(fileName)) {
				const fileContent = ctx.options.host!.readFile(fileName);
				if (fileContent !== undefined) {
					const script = {
						projectVersion: ctx.projectVersion,
						modifiedTime,
						scriptSnapshot: ts.ScriptSnapshot.fromString(fileContent),
						version: ctx.options.host!.createHash?.(fileContent) ?? fileContent,
					};
					scripts.set(fileName, script);
					return script;
				}
			}
		}
	}
	else {
		program.__vue.options = options;
		program.__vue.projectVersion++;
	}

	for (const rootName of options.rootNames) {
		// register file watchers
		options.host.getSourceFile(rootName, ts.ScriptTarget.ESNext);
	}

	const vueCompilerOptions = program.__vue.languageServiceHost.getVueCompilationSettings();
	if (vueCompilerOptions.experimentalTscProgramCallbacks) {
		for (const cbPath of vueCompilerOptions.experimentalTscProgramCallbacks) {
			const dir = program.__vue.languageServiceHost.getCurrentDirectory();
			const cb = require(require.resolve(cbPath, { paths: [dir] }));
			cb(program);
		}
	}

	return program;
}

export function loadTsLib() {
	return ts;
}

function doThrow(msg: string) {
	console.error(msg);
	throw msg;
}
