import type * as ts from 'typescript/lib/tsserverlibrary';
import * as vue from '@vue/language-core';
import * as volarTs from '@volar/typescript';
import { state } from './shared';

export type Hook = (program: _Program) => void;

export type _Program = ts.Program & { __vue: ProgramContext; };

interface ProgramContext {
	projectVersion: number;
	options: ts.CreateProgramOptions;
	vueCompilerOptions: Partial<vue.VueCompilerOptions>;
	project: vue.Project;
	languageService: ts.LanguageService;
}

const windowsPathReg = /\\/g;

export function createProgram(options: ts.CreateProgramOptions) {

	if (!options.options.noEmit && !options.options.emitDeclarationOnly)
		throw toThrow('js emit is not supported');

	if (!options.options.noEmit && options.options.noEmitOnError)
		throw toThrow('noEmitOnError is not supported');

	if (options.options.extendedDiagnostics || options.options.generateTrace)
		throw toThrow('--extendedDiagnostics / --generateTrace is not supported, please run `Write Virtual Files` in VSCode to write virtual files and use `--extendedDiagnostics` / `--generateTrace` via tsc instead of vue-tsc to debug.');

	if (!options.host)
		throw toThrow('!options.host');

	const ts = require('typescript') as typeof import('typescript/lib/tsserverlibrary');

	let program = options.oldProgram as _Program | undefined;

	if (state.hook) {
		program = state.hook.program;
		program.__vue.options = options;
	}
	else if (!program) {

		const ctx: ProgramContext = {
			projectVersion: 0,
			options,
			get vueCompilerOptions() {
				return vueCompilerOptions;
			},
			get languageService() {
				return vueTsLs;
			},
			get project() {
				return project;
			},
		};
		const vueCompilerOptions = getVueCompilerOptions();
		const scripts = new Map<string, {
			projectVersion: number,
			modifiedTime: number,
			scriptSnapshot: ts.IScriptSnapshot,
		}>();
		const projectHost: vue.TypeScriptProjectHost = {
			configFileName: undefined,
			getCurrentDirectory() {
				return ctx.options.host!.getCurrentDirectory().replace(windowsPathReg, '/');
			},
			getCompilationSettings: () => ctx.options.options,
			getScriptFileNames: () => {
				return ctx.options.rootNames as string[];
			},
			getScriptSnapshot,
			getProjectVersion: () => {
				return ctx.projectVersion.toString();
			},
			getProjectReferences: () => ctx.options.projectReferences,
			getCancellationToken: ctx.options.host!.getCancellationToken ? () => ctx.options.host!.getCancellationToken!() : undefined,
		};
		const fileNameResolutionHost = {
			fileNameToId: (fileName: string) => fileName,
			idToFileName: (id: string) => id,
		};
		const project = vue.createTypeScriptProject(
			vue.createLanguages(
				ts,
				projectHost.getCompilationSettings(),
				vueCompilerOptions,
			),
			projectHost,
			fileNameResolutionHost.fileNameToId,
			vue.resolveCommonLanguageId,
		);
		const languageServiceHost = volarTs.createLanguageServiceHost(
			project.typescript!.projectHost,
			project.fileProvider,
			fileNameResolutionHost,
			ts,
			ts.sys
		);
		const vueTsLs = ts.createLanguageService(languageServiceHost, volarTs.getDocumentRegistry(ts, ts.sys.useCaseSensitiveFileNames, projectHost.getCurrentDirectory()));

		volarTs.decorateLanguageService(project.fileProvider, vueTsLs, false);

		program = volarTs.getProgram(
			ts as any,
			project.fileProvider,
			fileNameResolutionHost,
			vueTsLs,
			ts.sys
		) as (ts.Program & { __vue: ProgramContext; });
		program.__vue = ctx;

		function getVueCompilerOptions(): Partial<vue.VueCompilerOptions> {
			const tsConfig = ctx.options.options.configFilePath;
			if (typeof tsConfig === 'string') {
				return vue.createParsedCommandLine(ts as any, ts.sys, tsConfig.replace(windowsPathReg, '/')).vueOptions;
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
