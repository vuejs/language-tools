import * as ts from 'typescript';
import * as vue from '@vue/language-core';
import * as vueTs from '@vue/typescript';
import { state } from './shared';

export type Hook = (program: _Program) => void;

export type _Program = ts.Program & { __vue: ProgramContext; };

interface ProgramContext {
	projectVersion: number,
	options: ts.CreateProgramOptions,
	languageHost: vue.TypeScriptLanguageHost,
	vueCompilerOptions: Partial<vue.VueCompilerOptions>,
	languageService: ReturnType<typeof vueTs.createLanguageService>,
}

export function createProgram(options: ts.CreateProgramOptions) {

	if (!options.options.noEmit && !options.options.emitDeclarationOnly)
		throw toThrow('js emit is not supported');

	if (!options.options.noEmit && options.options.noEmitOnError)
		throw toThrow('noEmitOnError is not supported');

	if (options.options.extendedDiagnostics || options.options.generateTrace)
		throw toThrow('--extendedDiagnostics / --generateTrace is not supported, please run `Write Virtual Files` in VSCode to write virtual files and use `--extendedDiagnostics` / `--generateTrace` via tsc instead of vue-tsc to debug.');

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
			get languageHost() {
				return languageHost;
			},
			get vueCompilerOptions() {
				return vueCompilerOptions;
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
		}>();
		const languageHost: vue.TypeScriptLanguageHost = {
			getCompilationSettings: () => ctx.options.options,
			getScriptFileNames: () => {
				return ctx.options.rootNames as string[];
			},
			getScriptVersion: (fileName) => {
				return ts.sys.getModifiedTime?.(fileName)?.valueOf().toString();

			},
			getScriptSnapshot,
			getProjectVersion: () => {
				return ctx.projectVersion;
			},
			getProjectReferences: () => ctx.options.projectReferences,
			getCurrentDirectory: () => ctx.options.host!.getCurrentDirectory(),
			getCancellationToken: ctx.options.host!.getCancellationToken ? () => ctx.options.host!.getCancellationToken!() : undefined,
		};
		const vueTsLs = vueTs.createLanguageService(languageHost, vueCompilerOptions, ts as any, {
			...ts.sys,
			writeFile: (fileName, content) => {
				if (fileName.indexOf('__VLS_') === -1) {
					ctx.options.host!.writeFile(fileName, content, false);
				}
			},
		});

		program = vueTsLs.getProgram() as (ts.Program & { __vue: ProgramContext; });
		program.__vue = ctx;

		function getVueCompilerOptions(): Partial<vue.VueCompilerOptions> {
			const tsConfig = ctx.options.options.configFilePath;
			if (typeof tsConfig === 'string') {
				return vue.createParsedCommandLine(ts as any, ts.sys, tsConfig).vueOptions;
			}
			return {};
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

	const vueCompilerOptions = program.__vue.vueCompilerOptions;
	if (vueCompilerOptions?.hooks) {
		const index = (state.hook?.index ?? -1) + 1;
		if (index < vueCompilerOptions.hooks.length) {
			const hookPath = vueCompilerOptions.hooks[index];
			const hook: Hook = require(hookPath);
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

function toThrow(msg: string) {
	console.error(msg);
	return msg;
}
