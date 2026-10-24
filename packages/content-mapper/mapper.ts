import type { IScriptSnapshot } from '@volar/language-core';
import * as vue from '@vue/language-core';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { toDiagnosticDirectives, withSynthesizedDiagnosticIgnores } from './diagnosticDirectives';
import type {
	OpenProjectParams,
	OpenProjectResult,
	OptionDiagnostic,
	TransformParams,
	TransformResult,
} from './protocol';
import { toSpanMappings } from './spanMappings';
import { loadTypeScript } from './typescript';
import { resolveVueCompilerOptions } from './vueOptions';

interface ProjectConfiguration {
	plugin: ReturnType<typeof vue.createVueLanguagePlugin<string>>;
	languageFeatures: boolean;
	virtualCodes: Map<string, NonNullable<ReturnType<NonNullable<ProjectConfiguration['plugin']['createVirtualCode']>>>>;
}

interface ProjectState {
	params: OpenProjectParams;
	configurations: Map<string, ProjectConfiguration>;
}

export interface ContentMapperFrontend {
	/** Human-readable mapper name, used in internal error messages. */
	name: string;
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
 * Creates the project configuration and transform pipeline of the Vue content mapper. Files reach
 * it because the host registered their extensions; the entry's `format` option decides how they are
 * parsed (`"sfc"` by default, `"vitepress"` for VitePress markdown, or `"petite-vue"` for petite-vue HTML).
 */
export function createContentMapper(frontend: ContentMapperFrontend): ContentMapper {
	const projects = new Map<string, ProjectState>();

	function openProject(params: OpenProjectParams): OpenProjectResult {
		const state: ProjectState = {
			params,
			configurations: new Map(),
		};
		projects.set(params.projectHandle, state);

		// The entry's options arrive in `params`, but resolving `target: 'auto'` and the entry's `plugins`
		// still reads dynamic inputs, so the configuration is always created through the watching host.
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
		const state = projects.get(params.projectHandle);
		if (!state) {
			throw new Error(`Unknown ${frontend.name} project handle: ${params.projectHandle}`);
		}

		const configuration = getConfiguration(state);
		const snapshot: IScriptSnapshot = {
			getText: (start, end) => params.content.slice(start, end),
			getLength: () => params.content.length,
			getChangeRange: () => undefined,
		};
		const root = configuration.plugin.createVirtualCode?.(
			params.fileName,
			configuration.plugin.getLanguageId(params.fileName)!,
			snapshot,
			{ getAssociatedScript: () => undefined },
		);
		if (root) {
			configuration.virtualCodes.set(params.fileName, root);
		}
		const serviceScript = root && vue.getServiceScript(root);

		if (!serviceScript) {
			return {
				text: 'export {};\n',
				extension: '.ts',
				mappings: [],
			};
		}

		const text = serviceScript.code.snapshot.getText(0, serviceScript.code.snapshot.getLength());
		const mappings = toSpanMappings(
			serviceScript.code.mappings,
			text,
			params.content,
			configuration.languageFeatures,
		);
		const generatedCode = serviceScript.code as vue.VueGeneratedCode;
		const diagnosticDirectives = toDiagnosticDirectives(generatedCode.diagnosticDirectives);
		return {
			text,
			extension: serviceScript.extension,
			diagnosticDirectives: {
				unusedExpectDirectiveDiagnostics: [{
					code: 2578,
					messageText: "Unused '@vue-expect-error' directive.",
				}],
				directives: withSynthesizedDiagnosticIgnores(
					text.length,
					mappings,
					diagnosticDirectives,
					generatedCode.diagnosticIgnores,
				),
			},
			mappings,
		};
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
		const readFile = watchedFiles
			? (fileName: string) => {
				const content = readFileIfExists(fileName);
				if (content !== undefined && path.isAbsolute(fileName)) {
					watchedFiles.add(path.normalize(fileName));
				}
				return content;
			}
			: readFileIfExists;
		const rootDir = configFileName
			? path.dirname(configFileName)
			: process.cwd();
		const { languageFeatures, ...mapperOptions } = state.params.options ?? {};
		const vueOptions = resolveVueCompilerOptions(readFile, configFileName || undefined, state.params.options);
		const configuration = {
			plugin: vue.createVueLanguagePlugin<string>(
				loadTypeScript(),
				vueOptions,
				fileName => fileName,
			),
			languageFeatures: languageFeatures !== false,
			virtualCodes: new Map(),
		};
		if (watchedFiles) {
			addPluginWatchFiles(watchedFiles, mapperOptions.plugins, rootDir);
		}
		state.configurations.set(configFileName, configuration);
		return configuration;
	}

	return {
		name: frontend.name,
		diagnosticSource: frontend.diagnosticSource ?? 'vue',
		openProject,
		closeProject,
		transform,
	};
}

function createIdentity(params: OpenProjectParams, watchedFiles: Iterable<string>) {
	const hash = createHash('sha256');
	hash.update(JSON.stringify(params.options ?? null));
	for (const fileName of [...watchedFiles].sort()) {
		hash.update(fileName);
		hash.update(readFileIfExists(fileName) ?? '');
	}
	return hash.digest('hex');
}

function readFileIfExists(fileName: string) {
	try {
		return fs.readFileSync(fileName, 'utf8').replace(/^\uFEFF/, '');
	}
	catch {}
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
