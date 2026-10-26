import type { IScriptSnapshot } from '@volar/language-core';
import * as vue from '@vue/language-core';
import { loadTypeScript } from '@vue/language-core/typescript';
import { computed } from 'alien-signals';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { useServiceScript } from './lib/codegen';
import { toTransformResult } from './lib/transform';
import { OptionDiagnosticCode } from './optionDiagnostics';
import type {
	OpenProjectParams,
	OpenProjectResult,
	OptionDiagnostic,
	TransformParams,
	TransformResult,
} from './protocol';
import { resolveMapperOptions } from './vueOptions';

interface ProjectConfiguration {
	ts: vue.TypeScript;
	pipeline: vue.IRPipeline;
	languageFeatures: boolean;
	vueOptions: vue.VueCompilerOptions;
	pluginFiles: string[];
	/** Why entries of `plugins`, or the `format`, have no effect. */
	pluginErrors: vue.VuePluginError[];
	files: Map<string, FileState>;
}

interface FileState {
	source: vue.VueSource;
	getResult: () => TransformResult;
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
			optionDiagnostics: [
				...frontend.toOptionDiagnostics?.(params.options) ?? [],
				...configuration.pluginErrors.map(error => toPluginDiagnostic(params.options, error)),
			],
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
				configuration.pipeline,
				params.fileName,
				snapshot,
			);
			const getServiceScript = useServiceScript(configuration.ts, source);
			file = {
				source,
				getResult: computed(() =>
					toTransformResult(
						getServiceScript(),
						source.ir,
						source.ir.content,
						configuration.languageFeatures,
					)
				),
			};
			configuration.files.set(params.fileName, file);
		}
		return file.getResult();
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
		const { languageFeatures, vueOptions, pluginFiles, pluginErrors } = resolveMapperOptions(
			readFile,
			configFileName || undefined,
			state.params.options,
		);
		const ts = loadTypeScript();
		const pipeline = vue.createIRPipeline(ts, vueOptions);
		const configuration: ProjectConfiguration = {
			ts,
			pipeline,
			languageFeatures,
			vueOptions,
			pluginFiles,
			pluginErrors: [...pluginErrors, ...pipeline.errors],
			files: new Map(),
		};
		if (watchedFiles) {
			for (const fileName of configuration.pluginFiles) {
				watchedFiles.add(path.normalize(fileName));
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
			configuration.pluginFiles.map(fileName => {
				const content = readFileIfExists(fileName) ?? null;
				// A package is identified by its version, not by the rest of its manifest
				if (content !== null && path.basename(fileName) === 'package.json') {
					try {
						const { name, version } = JSON.parse(content);
						return `${name}@${version}`;
					}
					catch {}
				}
				return content;
			}),
		]))
		.digest('hex');
}

/** The diagnostic of `error` at its entry of the `plugins` option, or at the `format` option. */
function toPluginDiagnostic(options: OpenProjectParams['options'], error: vue.VuePluginError): OptionDiagnostic {
	if (error.plugin === undefined) {
		return { path: ['format'], messageText: error.message, code: OptionDiagnosticCode.InvalidOptionType };
	}
	const entries = Array.isArray(options?.plugins) ? options.plugins as unknown[] : [];
	const index = entries.findIndex(entry =>
		(typeof entry === 'string' ? entry : (entry as { name?: unknown } | null)?.name) === error.plugin
	);
	return {
		path: index >= 0 ? ['plugins', index] : ['plugins'],
		messageText: `Plugin '${error.plugin}': ${error.message}`,
		code: OptionDiagnosticCode.InvalidPlugin,
	};
}

function readFileIfExists(fileName: string) {
	try {
		return fs.readFileSync(fileName, 'utf8').replace(/^\uFEFF/, '');
	}
	catch {}
}
