import type { IScriptSnapshot } from '@volar/language-core';
import * as vue from '@vue/language-core';
import { loadTypeScript } from '@vue/language-core/lib/typescript';
import { toString } from 'muggle-string';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { withSynthesizedDiagnosticIgnores } from './diagnosticDirectives';
import { buildDiagnosticDirectives, buildMappings } from './lib/buildMappings';
import { type ServiceScript, useServiceScript } from './lib/codegen';
import { getUnusedExpectErrorMessage } from './localization';
import type {
	OpenProjectParams,
	OpenProjectResult,
	OptionDiagnostic,
	TransformParams,
	TransformResult,
} from './protocol';
import { toSpanMappings } from './spanMappings';
import { resolveMapperOptions } from './vueOptions';

interface ProjectConfiguration {
	ts: vue.TypeScript;
	plugins: vue.VueLanguagePluginReturn[];
	languageFeatures: boolean;
	vueOptions: vue.VueCompilerOptions;
	pluginFiles: string[];
	files: Map<string, FileState>;
}

interface FileState {
	source: vue.VueSource;
	getServiceScript: () => ServiceScript;
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
		const configuration = createConfiguration(state, params.configFileName, watchedFiles);
		return {
			configIdentity: createIdentity(params, configuration),
			watchedFiles: [...watchedFiles].sort(),
			optionDiagnostics: frontend.toOptionDiagnostics?.(params.options),
		};
	}

	function closeProject(projectHandle: string) {
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
		let file = configuration.files.get(params.fileName);
		if (file) {
			file.source.update(snapshot);
		}
		else {
			const source = vue.createVueSource(
				configuration.ts,
				configuration.vueOptions,
				configuration.plugins,
				params.fileName,
				snapshot,
			);
			file = {
				source,
				getServiceScript: useServiceScript(configuration.ts, source),
			};
			configuration.files.set(params.fileName, file);
		}

		const serviceScript = file.getServiceScript();
		const codes = vue.resolveCodeOffsets(file.source.ir, serviceScript.codes);
		const text = toString(codes);
		const mappings = toSpanMappings(
			buildMappings(codes),
			text,
			params.content,
			configuration.languageFeatures,
		);
		return {
			text,
			extension: `.${serviceScript.lang}`,
			diagnosticDirectives: {
				unusedExpectDirectiveDiagnostics: [{
					code: 2578,
					messageText: getUnusedExpectErrorMessage(),
				}],
				directives: withSynthesizedDiagnosticIgnores(
					text.length,
					mappings,
					buildDiagnosticDirectives(codes),
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
		const { rootDir, languageFeatures, plugins, vueOptions } = resolveMapperOptions(
			readFile,
			configFileName || undefined,
			state.params.options,
		);
		const ts = loadTypeScript();
		const configuration: ProjectConfiguration = {
			ts,
			plugins: vue.createVuePlugins(ts, vueOptions),
			languageFeatures,
			vueOptions,
			pluginFiles: resolvePluginFiles(plugins, rootDir),
			files: new Map(),
		};
		if (watchedFiles) {
			for (const fileName of configuration.pluginFiles) {
				watchedFiles.add(fileName);
			}
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

/**
 * Fingerprints the effective configuration rather than the files it was read from, so projects whose
 * configurations resolve the same, e.g. each through its own `node_modules/vue`, share their transforms
 * in the host's cache.
 */
function createIdentity(params: OpenProjectParams, configuration: ProjectConfiguration) {
	const { plugins, isDataAttribute, isHtmlAttribute, ...vueOptions } = configuration.vueOptions;
	return createHash('sha256')
		.update(JSON.stringify([
			params.options ?? null,
			configuration.languageFeatures,
			vueOptions,
			configuration.pluginFiles.map(fileName => readFileIfExists(fileName) ?? null),
		]))
		.digest('hex');
}

function readFileIfExists(fileName: string) {
	try {
		return fs.readFileSync(fileName, 'utf8').replace(/^\uFEFF/, '');
	}
	catch {}
}

function resolvePluginFiles(plugins: unknown, rootDir: string) {
	const fileNames: string[] = [];
	if (!Array.isArray(plugins)) {
		return fileNames;
	}
	for (const plugin of plugins) {
		const name = typeof plugin === 'string' ? plugin : plugin?.name;
		if (typeof name !== 'string') {
			continue;
		}
		try {
			fileNames.push(require.resolve(name, { paths: [rootDir] }));
		}
		catch {}
	}
	return fileNames;
}
