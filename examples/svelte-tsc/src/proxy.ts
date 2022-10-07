import * as ts from 'typescript/lib/tsserverlibrary';
import * as svelte from '@volar-examples/svelte-language-core';
import * as svelteTs from '@volar-examples/svelte-typescript';

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

	let program = options.oldProgram as any;

	if (!program) {

		const ctx = {
			projectVersion: 0,
			options: options,
		};
		const scripts = new Map<string, {
			projectVersion: number,
			modifiedTime: number,
			scriptSnapshot: ts.IScriptSnapshot,
			version: string,
		}>();
		const svelteLsHost = new Proxy(<svelte.LanguageServiceHost>{
			resolveModuleNames: undefined, // avoid failed with tsc built-in fileExists
			getCompilationSettings: () => ctx.options.options,
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
					return target[property as keyof svelte.LanguageServiceHost];
				}
				return ctx.options.host![property as keyof ts.CompilerHost];
			},
		});
		const svelteTsLs = svelteTs.createLanguageService(svelteLsHost);

		program = svelteTsLs.getProgram();
		program.__svelte = ctx;

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
		program.__svelte.options = options;
		program.__svelte.projectVersion++;
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

function doThrow(msg: string) {
	console.error(msg);
	throw msg;
}
