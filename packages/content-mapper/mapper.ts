import * as vue from '@vue/language-core';
import { createHash } from 'node:crypto';
import * as path from 'node:path';
import { toDiagnosticDirectives, withSynthesizedDiagnosticIgnores } from './diagnosticDirectives';
import type {
	OpenProjectParams,
	OpenProjectResult,
	OptionDiagnostic,
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

/**
 * The parts that differ between Vue content mappers: which extensions and syntaxes a mapper claims
 * is decided by its registration, so a mapper only contributes the language plugins that make its
 * files understandable to the shared Vue codegen.
 */
export interface ContentMapperFrontend {
	/** Human-readable mapper name, used in internal error messages. */
	name: string;
	/** Language plugins that every project of this mapper activates, ahead of user plugins. */
	plugins?: (context: { rootDir: string }) => vue.VueLanguagePlugin[];
	/** Language id used when no plugin claims the transformed file. */
	defaultLanguageId?: string;
	/** Prefix for mapper-authored diagnostics, e.g. `error vue@1.0.0(1): ...`. */
	diagnosticSource?: string;
	/** Validates the mapper entry's `options`, reported to the host as `optionDiagnostics`. */
	toOptionDiagnostics?: (options: Record<string, unknown> | undefined) => OptionDiagnostic[];
}

export interface ContentMapper {
	readonly name: string;
	readonly diagnosticSource: string;
	openProject(params: OpenProjectParams): OpenProjectResult;
	closeProject(projectHandle: string): void;
	transform(params: TransformParams): TransformResult;
}

/**
 * Creates the project configuration and transform pipeline shared by every Vue content mapper.
 * Files reach a mapper because the host registered its extensions, so the front-end only decides
 * how a file is understood, not which files arrive.
 */
export function createContentMapper(frontend: ContentMapperFrontend): ContentMapper {
	const projects = new Map<string, ProjectState>();
	const defaultLanguageId = frontend.defaultLanguageId ?? 'vue';

	function openProject(params: OpenProjectParams): OpenProjectResult {
		const state: ProjectState = {
			params,
			configurations: new Map(),
		};
		projects.set(params.projectHandle, state);

		// Inferred projects have no tsconfig, but resolving `target: 'auto'` and the mapper entry's
		// `plugins` still reads dynamic inputs, so the configuration is always created through the
		// watching host.
		const watchedFiles = new Set<string>();
		createConfiguration(state, params.configFileName, watchedFiles);
		return {
			configIdentity: createIdentity(params, watchedFiles),
			watchedFiles: [...watchedFiles].sort(),
			optionDiagnostics: frontend.toOptionDiagnostics?.(params.options),
		};
	}

	function closeProject(projectHandle: string) {
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

	function transform(params: TransformParams): TransformResult {
		const state = params.projectHandle
			? projects.get(params.projectHandle)
			: undefined;
		if (params.projectHandle && !state) {
			throw new Error(`Unknown ${frontend.name} project handle: ${params.projectHandle}`);
		}

		const configuration = state
			? getConfiguration(state)
			: createStandaloneConfiguration(params);
		const snapshot = ts.ScriptSnapshot.fromString(params.content);
		const languageId = configuration.plugin.getLanguageId(params.fileName) ?? defaultLanguageId;
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
					messageText: "Unused '@vue-expect-error' directive.",
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
		const { languageFeatures, ...mapperOptions } = state.params.options ?? {};
		const watchedBefore = watchedFiles ? new Set(watchedFiles) : undefined;
		const parsed = configFileName
			? vue.createParsedCommandLine(ts, host, normalizePath(configFileName))
			: undefined;
		// `createParsedCommandLine` is the only reader of the tsconfig `extends` chain, so the files it
		// added are exactly the configs that may declare legacy Vue options.
		const configFileNames = configFileName
			? [
				normalizePath(configFileName),
				...(watchedFiles && watchedBefore
					? [...watchedFiles].filter(fileName => !watchedBefore.has(fileName))
					: []),
			]
			: [];
		// v4 moves the Vue compiler options from the tsconfig's `vueCompilerOptions` field to the mapper
		// entry's `options`; apply the entry options on top of any options a tsconfig still carries.
		const baseVueOptions = parsed?.vueOptions ?? vue.getDefaultCompilerOptions();
		const resolver = new vue.CompilerOptionsResolver(ts, host.readFile);
		resolver.addConfig(mapperOptions as vue.RawVueCompilerOptions, normalizePath(rootDir));
		const vueOptions = resolver.build({
			...baseVueOptions,
			target: resolver.target ?? baseVueOptions.target,
			typesRoot: resolver.typesRoot ?? baseVueOptions.typesRoot,
		});
		vueOptions.plugins = [
			...new Set([
				...frontend.plugins?.({ rootDir: normalizePath(rootDir) }) ?? [],
				...baseVueOptions.plugins,
				...resolver.plugins,
			]),
		];
		const compilerOptions = normalizeCompilerOptions(state.params.compilerOptions);
		const configuration = {
			plugin: vue.createVueLanguagePlugin<string>(
				ts,
				{ ...parsed?.options, ...compilerOptions },
				vueOptions,
				fileName => fileName,
			),
			languageFeatures: languageFeatures !== false,
			virtualCodes: new Map(),
		};
		if (watchedFiles) {
			addPluginWatchFiles(watchedFiles, mapperOptions.plugins, rootDir);
			addConfigPluginWatchFiles(watchedFiles, configFileNames);
		}
		state.configurations.set(configFileName, configuration);
		return configuration;
	}

	function createStandaloneConfiguration(params: TransformParams): ProjectConfiguration {
		const configFileName = ts.findConfigFile(path.dirname(params.fileName), ts.sys.fileExists);
		const parsed = configFileName
			? vue.createParsedCommandLine(ts, ts.sys, normalizePath(configFileName))
			: vue.createParsedCommandLineByJson(ts, ts.sys, normalizePath(path.dirname(params.fileName)), {});
		const vueOptions = {
			...parsed.vueOptions,
			plugins: [
				...new Set([
					...frontend.plugins?.({ rootDir: normalizePath(path.dirname(params.fileName)) }) ?? [],
					...parsed.vueOptions.plugins,
				]),
			],
		};
		return {
			plugin: vue.createVueLanguagePlugin<string>(
				ts,
				parsed.options,
				vueOptions,
				fileName => fileName,
			),
			languageFeatures: true,
			virtualCodes: new Map(),
		};
	}

	return {
		name: frontend.name,
		diagnosticSource: frontend.diagnosticSource ?? 'vue',
		openProject,
		closeProject,
		transform,
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

function addPluginWatchFiles(watchedFiles: Set<string>, plugins: unknown, rootDir: string) {
	if (!Array.isArray(plugins)) {
		return;
	}
	for (const plugin of plugins) {
		const name = typeof plugin === 'string' ? plugin : plugin?.name;
		if (typeof name !== 'string') {
			continue;
		}
		try {
			watchedFiles.add(require.resolve(name, { paths: [rootDir] }));
		}
		catch {}
	}
}

/**
 * A tsconfig may still carry `vueCompilerOptions.plugins`; `createParsedCommandLine` loads those
 * plugins, so their entry files participate in transforms and must be watched as well.
 */
function addConfigPluginWatchFiles(watchedFiles: Set<string>, configFileNames: string[]) {
	for (const configFileName of configFileNames) {
		const content = ts.sys.readFile(configFileName);
		if (content === undefined) {
			continue;
		}
		const plugins = ts.parseConfigFileTextToJson(configFileName, content).config?.vueCompilerOptions?.plugins;
		if (plugins !== undefined) {
			addPluginWatchFiles(watchedFiles, plugins, path.dirname(configFileName));
		}
	}
}

function normalizePath(fileName: string) {
	return fileName.replace(/\\/g, '/');
}
