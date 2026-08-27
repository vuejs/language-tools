import * as vue from '@vue/language-core';
import { createHash } from 'node:crypto';
import * as path from 'node:path';
import { toDiagnosticDirectives, withSynthesizedDiagnosticIgnores } from './diagnosticDirectives';
import type {
	OpenProjectParams,
	OpenProjectResult,
	TransformParams,
	TransformResult,
	VirtualExtension,
} from './protocol';
import { toSpanMappings } from './spanMappings';
import { loadTypeScript } from './typescript';

const ts = loadTypeScript();

interface ProjectConfiguration {
	plugin: ReturnType<typeof vue.createVueLanguagePlugin<string>>;
	languageFeatures: boolean;
	virtualCodes: Map<string, NonNullable<ReturnType<NonNullable<ProjectConfiguration['plugin']['createVirtualCode']>>>>;
}

interface ProjectState {
	params: OpenProjectParams;
	configurations: Map<string, ProjectConfiguration>;
}

const projects = new Map<string, ProjectState>();

export function openProject(params: OpenProjectParams): OpenProjectResult {
	const state: ProjectState = {
		params,
		configurations: new Map(),
	};
	projects.set(params.projectHandle, state);

	if (!params.configFileName) {
		return {
			configIdentity: createIdentity(params, []),
		};
	}

	const watchedFiles = new Set<string>();
	createConfiguration(state, params.configFileName, watchedFiles);
	return {
		configIdentity: createIdentity(params, watchedFiles),
		watchedFiles: [...watchedFiles].sort(),
	};
}

export function closeProject(projectHandle: string) {
	const state = projects.get(projectHandle);
	if (state) {
		for (const configuration of state.configurations.values()) {
			for (const [fileName, virtualCode] of configuration.virtualCodes) {
				configuration.plugin.disposeVirtualCode?.(fileName, virtualCode);
			}
		}
	}
	projects.delete(projectHandle);
}

export function transformVue(params: TransformParams): TransformResult {
	const state = params.projectHandle
		? projects.get(params.projectHandle)
		: undefined;
	if (params.projectHandle && !state) {
		throw new Error(`Unknown Vue content mapper project handle: ${params.projectHandle}`);
	}

	const configuration = state
		? getConfiguration(state)
		: createStandaloneConfiguration(params);
	const snapshot = ts.ScriptSnapshot.fromString(params.content);
	const languageId = configuration.plugin.getLanguageId(params.fileName) ?? 'vue';
	const root = configuration.plugin.createVirtualCode?.(
		params.fileName,
		languageId,
		snapshot,
		{ getAssociatedScript: () => undefined },
	);
	if (root) {
		configuration.virtualCodes.set(params.fileName, root);
	}
	const serviceScript = root && configuration.plugin.typescript?.getServiceScript(root);

	if (!serviceScript) {
		return {
			text: 'export {};\n',
			extension: '.ts',
			mappings: [],
		};
	}

	const text = serviceScript.code.snapshot.getText(0, serviceScript.code.snapshot.getLength());
	const extension = getVirtualExtension(serviceScript.extension);
	const mappings = toSpanMappings(
		serviceScript.code.mappings,
		text,
		params.content,
		configuration.languageFeatures,
	);
	const diagnosticDirectives = toDiagnosticDirectives(serviceScript.code.mappings);
	return {
		text,
		extension,
		diagnosticDirectives: {
			unusedExpectDirectiveDiagnostics: [{
				code: 2578,
				messageText: "Unused '@ts-expect-error' directive.",
			}],
			directives: withSynthesizedDiagnosticIgnores(
				text.length,
				mappings,
				diagnosticDirectives,
			),
		},
		mappings,
	};
}

function getVirtualExtension(extension: string): VirtualExtension {
	switch (extension) {
		case '.js':
			return '.js';
		case '.jsx':
			return '.jsx';
		case '.ts':
			return '.ts';
		case '.tsx':
			return '.tsx';
		case '.mjs':
		case '.cjs':
		case '.mts':
		case '.cts':
		case '.json':
			return extension;
		default:
			throw new Error(`Unsupported Vue service script extension: ${extension}`);
	}
}

function getConfiguration(state: ProjectState) {
	const configFileName = state.params.configFileName;
	let configuration = state.configurations.get(configFileName);
	if (!configuration) {
		configuration = createConfiguration(state, configFileName);
	}
	return configuration;
}

function createConfiguration(
	state: ProjectState,
	configFileName: string,
	watchedFiles?: Set<string>,
) {
	const host = watchedFiles
		? {
			...ts.sys,
			readFile(fileName: string) {
				const content = ts.sys.readFile(fileName);
				if (content !== undefined && path.isAbsolute(fileName)) {
					watchedFiles.add(path.normalize(fileName));
				}
				return content;
			},
		}
		: ts.sys;
	const rootDir = configFileName
		? path.dirname(configFileName)
		: process.cwd();
	if (watchedFiles && configFileName) {
		watchedFiles.add(path.normalize(configFileName));
	}
	const { languageFeatures, ...vueCompilerOptions } = state.params.options ?? {};
	const parsed = configFileName
		? vue.createParsedCommandLine(ts, host, normalizePath(configFileName))
		: vue.createParsedCommandLineByJson(ts, host, normalizePath(rootDir), { vueCompilerOptions });
	const compilerOptions = normalizeCompilerOptions(state.params.compilerOptions);
	const configuration = {
		plugin: vue.createVueLanguagePlugin<string>(
			ts,
			{ ...parsed.options, ...compilerOptions },
			parsed.vueOptions,
			fileName => fileName,
		),
		languageFeatures: languageFeatures !== false,
		virtualCodes: new Map(),
	};
	if (watchedFiles) {
		addPluginWatchFiles(watchedFiles);
	}
	state.configurations.set(configFileName, configuration);
	return configuration;
}

function createStandaloneConfiguration(params: TransformParams): ProjectConfiguration {
	const configFileName = ts.findConfigFile(path.dirname(params.fileName), ts.sys.fileExists);
	const parsed = configFileName
		? vue.createParsedCommandLine(ts, ts.sys, normalizePath(configFileName))
		: vue.createParsedCommandLineByJson(ts, ts.sys, normalizePath(path.dirname(params.fileName)), {});
	return {
		plugin: vue.createVueLanguagePlugin<string>(
			ts,
			{ ...parsed.options, ...normalizeCompilerOptions(params.compilerOptions ?? {}) },
			parsed.vueOptions,
			fileName => fileName,
		),
		languageFeatures: params.options?.languageFeatures !== false,
		virtualCodes: new Map(),
	};
}

function normalizeCompilerOptions(options: Record<string, unknown>) {
	// `options` already arrives in the numeric-enum wire format that
	// `ts.CompilerOptions` expects; `convertCompilerOptionsFromJson` expects
	// string enums and silently drops numeric `lib`/`target`/`module`/`jsx`.
	return options as ReturnType<typeof ts.convertCompilerOptionsFromJson>['options'];
}

function createIdentity(params: OpenProjectParams, watchedFiles: Iterable<string>) {
	const hash = createHash('sha256');
	hash.update(JSON.stringify(params.options ?? null));
	hash.update(JSON.stringify(params.compilerOptions));
	for (const fileName of [...watchedFiles].sort()) {
		hash.update(fileName);
		hash.update(ts.sys.readFile(fileName) ?? '');
	}
	return hash.digest('hex');
}

function addPluginWatchFiles(watchedFiles: Set<string>) {
	for (const configFileName of [...watchedFiles]) {
		const content = ts.sys.readFile(configFileName);
		if (!content) {
			continue;
		}
		const parsed = ts.parseConfigFileTextToJson(configFileName, content);
		const plugins = parsed.config?.vueCompilerOptions?.plugins;
		if (!Array.isArray(plugins)) {
			continue;
		}
		for (const plugin of plugins) {
			const name = typeof plugin === 'string' ? plugin : plugin?.name;
			if (typeof name !== 'string') {
				continue;
			}
			try {
				watchedFiles.add(require.resolve(name, { paths: [path.dirname(configFileName)] }));
			}
			catch {}
		}
	}
}

function normalizePath(fileName: string) {
	return fileName.replace(/\\/g, '/');
}
