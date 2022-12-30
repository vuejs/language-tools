import * as ts from 'typescript';
import * as vue from '@volar/vue-language-core';
import * as vueTs from '@volar/vue-typescript';
import { state } from './shared';

export type _Program = ts.Program & { __vue: ProgramContext; };

interface ProgramContext {
	projectVersion: number,
	options: ts.CreateProgramOptions,
	languageServiceHost: vue.LanguageServiceHost,
	languageService: ReturnType<typeof vueTs.createLanguageService>,
}

export function createProgram(
	options: ts.CreateProgramOptions, // rootNamesOrOptions: readonly string[] | CreateProgramOptions,
	_options?: ts.CompilerOptions,
	_host?: ts.CompilerHost,
	_oldProgram?: ts.Program,
	_configFileParsingDiagnostics?: readonly ts.Diagnostic[],
) {

	if (!options.options.noEmit && !options.options.emitDeclarationOnly)
		throw toThrow('js emit is not supported');

	if (!options.options.noEmit && options.options.noEmitOnError)
		throw toThrow('noEmitOnError is not supported');

	if (!options.host)
		throw toThrow('!options.host');

	let program = options.oldProgram as _Program | undefined;

	if (state.hook) {
		program = state.hook.program;
		program.__vue.options = options;
	}
	else if (!program) {

		const ctx: ProgramContext = {
			projectVersion: 0,
			options,
			get languageServiceHost() {
				return vueLsHost;
			},
			get languageService() {
				return vueTsLs;
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

		program = vueTsLs.getProgram() as (ts.Program & { __vue: ProgramContext; });
		program.__vue = ctx;

		function getVueCompilerOptions(): vue.VueCompilerOptions {
			const tsConfig = ctx.options.options.configFilePath;
			if (typeof tsConfig === 'string') {
				return vue.createParsedCommandLine(ts as any, ts.sys, tsConfig, []).vueOptions;
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
		const ctx: ProgramContext = program.__vue;
		ctx.options = options;
		ctx.projectVersion++;
	}

	const vueCompilerOptions = program.__vue.languageServiceHost.getVueCompilationSettings();
	if (vueCompilerOptions.hooks) {
		const index = (state.hook?.index ?? -1) + 1;
		if (index < vueCompilerOptions.hooks.length) {
			const hookPath = vueCompilerOptions.hooks[index];
			const hook = require(hookPath);
			state.hook = {
				program,
				index,
				worker: (async () => await hook(program))(),
			};
			throw 'hook';
		}
	}

	for (const rootName of options.rootNames) {
		// register file watchers
		options.host.getSourceFile(rootName, ts.ScriptTarget.ESNext);
	}

	return program;
}

export function loadTsLib() {
	return ts;
}

function toThrow(msg: string) {
	console.error(msg);
	return msg;
}
