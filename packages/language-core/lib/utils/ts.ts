import { camelize } from '@vue/shared';
import { posix as path } from 'path-browserify';
import type * as ts from 'typescript';
import { generateGlobalTypes, resolveGlobalTypesName } from '../codegen/globalTypes';
import { getAllExtensions } from '../languagePlugin';
import type { RawVueCompilerOptions, VueCompilerOptions, VueLanguagePlugin } from '../types';

export type ParsedCommandLine = ts.ParsedCommandLine & {
	vueOptions: VueCompilerOptions;
};

export function createParsedCommandLineByJson(
	ts: typeof import('typescript'),
	parseConfigHost: ts.ParseConfigHost & {
		writeFile?(path: string, data: string): void;
	},
	rootDir: string,
	json: any,
	configFileName = rootDir + '/jsconfig.json',
	skipGlobalTypesSetup = false
): ParsedCommandLine {

	const proxyHost = proxyParseConfigHostForExtendConfigPaths(parseConfigHost);
	ts.parseJsonConfigFileContent(json, proxyHost.host, rootDir, {}, configFileName);

	let vueOptions: Partial<VueCompilerOptions> = {};

	for (const extendPath of proxyHost.extendConfigPaths.reverse()) {
		try {
			vueOptions = {
				...vueOptions,
				...getPartialVueCompilerOptions(ts, ts.readJsonConfigFile(extendPath, proxyHost.host.readFile)),
			};
		} catch (err) { }
	}

	const resolvedVueOptions = resolveVueCompilerOptions(vueOptions);
	if (skipGlobalTypesSetup) {
		resolvedVueOptions.__setupedGlobalTypes = true;
	}
	else {
		resolvedVueOptions.__setupedGlobalTypes = setupGlobalTypes(rootDir, resolvedVueOptions, parseConfigHost);
	}
	const parsed = ts.parseJsonConfigFileContent(
		json,
		proxyHost.host,
		rootDir,
		{},
		configFileName,
		undefined,
		getAllExtensions(resolvedVueOptions)
			.map(extension => ({
				extension: extension.slice(1),
				isMixedContent: true,
				scriptKind: ts.ScriptKind.Deferred,
			}))
	);

	// fix https://github.com/vuejs/language-tools/issues/1786
	// https://github.com/microsoft/TypeScript/issues/30457
	// patching ts server broke with outDir + rootDir + composite/incremental
	parsed.options.outDir = undefined;

	return {
		...parsed,
		vueOptions: resolvedVueOptions,
	};
}

export function createParsedCommandLine(
	ts: typeof import('typescript'),
	parseConfigHost: ts.ParseConfigHost,
	tsConfigPath: string,
	skipGlobalTypesSetup = false
): ParsedCommandLine {
	try {
		const proxyHost = proxyParseConfigHostForExtendConfigPaths(parseConfigHost);
		const config = ts.readJsonConfigFile(tsConfigPath, proxyHost.host.readFile);
		ts.parseJsonSourceFileConfigFileContent(config, proxyHost.host, path.dirname(tsConfigPath), {}, tsConfigPath);

		let vueOptions: Partial<VueCompilerOptions> = {};

		for (const extendPath of proxyHost.extendConfigPaths.reverse()) {
			try {
				vueOptions = {
					...vueOptions,
					...getPartialVueCompilerOptions(ts, ts.readJsonConfigFile(extendPath, proxyHost.host.readFile)),
				};
			} catch (err) { }
		}

		const resolvedVueOptions = resolveVueCompilerOptions(vueOptions);
		if (skipGlobalTypesSetup) {
			resolvedVueOptions.__setupedGlobalTypes = true;
		}
		else {
			resolvedVueOptions.__setupedGlobalTypes = setupGlobalTypes(path.dirname(tsConfigPath), resolvedVueOptions, parseConfigHost);
		}
		const parsed = ts.parseJsonSourceFileConfigFileContent(
			config,
			proxyHost.host,
			path.dirname(tsConfigPath),
			{},
			tsConfigPath,
			undefined,
			getAllExtensions(resolvedVueOptions)
				.map(extension => ({
					extension: extension.slice(1),
					isMixedContent: true,
					scriptKind: ts.ScriptKind.Deferred,
				}))
		);

		// fix https://github.com/vuejs/language-tools/issues/1786
		// https://github.com/microsoft/TypeScript/issues/30457
		// patching ts server broke with outDir + rootDir + composite/incremental
		parsed.options.outDir = undefined;

		return {
			...parsed,
			vueOptions: resolvedVueOptions,
		};
	}
	catch (err) {
		// console.warn('Failed to resolve tsconfig path:', tsConfigPath, err);
		return {
			fileNames: [],
			options: {},
			vueOptions: resolveVueCompilerOptions({}),
			errors: [],
		};
	}
}

function proxyParseConfigHostForExtendConfigPaths(parseConfigHost: ts.ParseConfigHost) {
	const extendConfigPaths: string[] = [];
	const host = new Proxy(parseConfigHost, {
		get(target, key) {
			if (key === 'readFile') {
				return (fileName: string) => {
					if (!fileName.endsWith('/package.json') && !extendConfigPaths.includes(fileName)) {
						extendConfigPaths.push(fileName);
					}
					return target.readFile(fileName);
				};
			}
			return target[key as keyof typeof target];
		}
	});
	return {
		host,
		extendConfigPaths,
	};
}

function getPartialVueCompilerOptions(
	ts: typeof import('typescript'),
	tsConfigSourceFile: ts.TsConfigSourceFile
) {

	const folder = path.dirname(tsConfigSourceFile.fileName);
	const obj = ts.convertToObject(tsConfigSourceFile, []);
	const rawOptions: RawVueCompilerOptions = obj?.vueCompilerOptions ?? {};
	const result: Partial<VueCompilerOptions> = {
		...rawOptions as any,
	};
	const target = rawOptions.target ?? 'auto';

	if (target === 'auto') {
		const resolvedPath = resolvePath('vue/package.json');
		if (resolvedPath) {
			const vuePackageJson = require(resolvedPath);
			const versionNumbers = vuePackageJson.version.split('.');
			result.target = Number(versionNumbers[0] + '.' + versionNumbers[1]);
		}
		else {
			// console.warn('Load vue/package.json failed from', folder);
		}
	}
	else {
		result.target = target;
	}
	if (rawOptions.plugins) {
		const plugins = rawOptions.plugins
			.map<VueLanguagePlugin>((pluginPath: string) => {
				try {
					const resolvedPath = resolvePath(pluginPath);
					if (resolvedPath) {
						const plugin = require(resolvedPath);
						plugin.__moduleName = pluginPath;
						return plugin;
					}
					else {
						console.warn('[Vue] Load plugin failed:', pluginPath);
					}
				}
				catch (error) {
					console.warn('[Vue] Resolve plugin path failed:', pluginPath, error);
				}
				return [];
			});

		result.plugins = plugins;
	}

	return result;

	function resolvePath(scriptPath: string) {
		try {
			if (require?.resolve) {
				return require.resolve(scriptPath, { paths: [folder] });
			}
			else {
				// console.warn('failed to resolve path:', scriptPath, 'require.resolve is not supported in web');
			}
		}
		catch (error) {
			// console.warn(error);
		}
	}
}

export function getDefaultOptions(options: Partial<VueCompilerOptions>): VueCompilerOptions {
	const target = options.target ?? 3.3;
	const lib = options.lib ?? 'vue';
	return {
		target,
		lib,
		extensions: ['.vue'],
		vitePressExtensions: [],
		petiteVueExtensions: [],
		jsxSlots: false,
		strictTemplates: {
			attributes: false,
			components: false
		},
		skipTemplateCodegen: false,
		fallthroughAttributes: false,
		dataAttributes: [],
		htmlAttributes: ['aria-*'],
		optionsWrapper: target >= 2.7
			? [`(await import('${lib}')).defineComponent(`, `)`]
			: [`(await import('${lib}')).default.extend(`, `)`],
		macros: {
			defineProps: ['defineProps'],
			defineSlots: ['defineSlots'],
			defineEmits: ['defineEmits'],
			defineExpose: ['defineExpose'],
			defineModel: ['defineModel'],
			defineOptions: ['defineOptions'],
			withDefaults: ['withDefaults'],
		},
		composables: {
			useAttrs: ['useAttrs'],
			useCssModule: ['useCssModule'],
			useSlots: ['useSlots'],
			useTemplateRef: ['useTemplateRef', 'templateRef'],
		},
		plugins: [],
		experimentalDefinePropProposal: false,
		experimentalResolveStyleCssClasses: 'scoped',
		experimentalModelPropName: null!
	};
};

export function resolveVueCompilerOptions(
	options: Partial<VueCompilerOptions>,
	defaults: VueCompilerOptions = getDefaultOptions(options)
): VueCompilerOptions {
	const strictTemplates = typeof options.strictTemplates === 'boolean' ? {
		attributes: options.strictTemplates,
		components: options.strictTemplates
	} : options.strictTemplates ?? defaults.strictTemplates;

	return {
		...defaults,
		...options,
		strictTemplates,
		macros: {
			...defaults.macros,
			...options.macros,
		},
		composables: {
			...defaults.composables,
			...options.composables,
		},

		// https://github.com/vuejs/vue-next/blob/master/packages/compiler-dom/src/transforms/vModel.ts#L49-L51
		// https://vuejs.org/guide/essentials/forms.html#form-input-bindings
		experimentalModelPropName: Object.fromEntries(Object.entries(
			options.experimentalModelPropName ?? defaults.experimentalModelPropName ?? {
				'': {
					input: true
				},
				value: {
					input: { type: 'text' },
					textarea: true,
					select: true
				}
			}
		).map(([k, v]) => [camelize(k), v])),
	};
}

export function setupGlobalTypes(rootDir: string, vueOptions: VueCompilerOptions, host: {
	fileExists(path: string): boolean;
	writeFile?(path: string, data: string): void;
}): VueCompilerOptions['__setupedGlobalTypes'] {
	if (!host.writeFile) {
		return;
	}
	try {
		let dir = rootDir;
		while (!host.fileExists(path.join(dir, 'node_modules', vueOptions.lib, 'package.json'))) {
			const parentDir = path.dirname(dir);
			if (dir === parentDir) {
				throw 0;
			}
			dir = parentDir;
		}
		const globalTypesPath = path.join(dir, 'node_modules', '.vue-global-types', resolveGlobalTypesName(vueOptions));
		const globalTypesContents = `// @ts-nocheck\nexport {};\n` + generateGlobalTypes(vueOptions);
		host.writeFile(globalTypesPath, globalTypesContents);
		return { absolutePath: globalTypesPath };
	} catch { }
}
