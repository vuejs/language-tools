import * as ts from 'typescript/lib/tsserverlibrary';
import * as vue from '@volar/vue-typescript';
import * as shared from '@volar/shared';
import * as apis from './apis';
import { createBasicRuntime, createTypeScriptRuntime } from '@volar/vue-typescript';

export function createProgramProxy(options: ts.CreateProgramOptions) {

	if (!options.options.noEmit && !options.options.emitDeclarationOnly)
		return doThrow('js emit is not support');

	if (!options.host)
		return doThrow('!options.host');

	const host = options.host;
	const vueCompilerOptions = getVueCompilerOptions();
	const scriptSnapshots = new Map<string, ts.IScriptSnapshot>();
	const vueLsHost: vue.LanguageServiceHostBase = {
		...host,
		resolveModuleNames: undefined, // avoid failed with tsc built-in fileExists
		writeFile: undefined,
		getCompilationSettings: () => options.options,
		getVueCompilationSettings: () => vueCompilerOptions,
		getScriptFileNames: () => options.rootNames as string[],
		getScriptVersion: () => '',
		getScriptSnapshot,
		getProjectVersion: () => '',
		getVueProjectVersion: () => '',
		getProjectReferences: () => options.projectReferences,
	};
	const services = createBasicRuntime();
	const tsRuntime = createTypeScriptRuntime({ typescript: ts, ...services, compilerOptions: vueCompilerOptions }, vueLsHost, false);
	const tsProgram = tsRuntime.context.scriptTsLsRaw.getProgram(); // TODO: handle template ls?
	if (!tsProgram) throw '!tsProgram';

	const tsProgramApis_2 = apis.register(ts, tsRuntime.context);
	const tsProgramProxy = new Proxy<ts.Program>(tsProgram, {
		get: (target: any, property: keyof typeof tsProgramApis_2) => {
			tsRuntime.update(true);
			return tsProgramApis_2[property] || target[property];
		},
	});

	return tsProgramProxy;

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
