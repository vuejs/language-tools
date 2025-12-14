import { camelize } from '@vue/shared';
import { posix as path } from 'path-browserify';
import type * as ts from 'typescript';
import type { RawVueCompilerOptions, VueCompilerOptions, VueLanguagePlugin } from './types';
import { hyphenateTag } from './utils/shared';

interface ParseConfigHost extends Omit<ts.ParseConfigHost, 'readDirectory'> {}

export interface ParsedCommandLine extends Omit<ts.ParsedCommandLine, 'fileNames'> {
	vueOptions: VueCompilerOptions;
}

export function createParsedCommandLineByJson(
	ts: typeof import('typescript'),
	host: ParseConfigHost,
	rootDir: string,
	json: any,
	configFileName?: string,
): ParsedCommandLine {
	const extendedPaths = new Set<string>();
	const proxyHost = {
		...host,
		readFile(fileName: string) {
			if (!fileName.endsWith('/package.json')) {
				extendedPaths.add(fileName);
			}
			return host.readFile(fileName);
		},
		readDirectory() {
			return [];
		},
	};
	const config = ts.readJsonConfigFile(rootDir, () => JSON.stringify(json));
	const parsed = ts.parseJsonSourceFileConfigFileContent(
		config,
		proxyHost,
		rootDir,
		{},
		configFileName,
	);
	const resolver = new CompilerOptionsResolver(host.fileExists);

	for (const extendPath of [...extendedPaths].reverse()) {
		try {
			const configFile = ts.readJsonConfigFile(extendPath, host.readFile);
			const obj = ts.convertToObject(configFile, []);
			const rawOptions: RawVueCompilerOptions = obj?.vueCompilerOptions ?? {};
			resolver.addConfig(rawOptions, path.dirname(configFile.fileName));
		}
		catch {}
	}

	resolver.addConfig(json?.vueCompilerOptions ?? {}, rootDir);

	return {
		...parsed,
		vueOptions: resolver.build(),
	};
}

export function createParsedCommandLine(
	ts: typeof import('typescript'),
	host: ParseConfigHost,
	configFileName: string,
): ParsedCommandLine {
	try {
		const extendedPaths = new Set<string>();
		const proxyHost = {
			...host,
			readFile(fileName: string) {
				if (!fileName.endsWith('/package.json')) {
					extendedPaths.add(fileName);
				}
				return host.readFile(fileName);
			},
			readDirectory() {
				return [];
			},
		};
		const config = ts.readJsonConfigFile(configFileName, proxyHost.readFile);
		const parsed = ts.parseJsonSourceFileConfigFileContent(
			config,
			proxyHost,
			path.dirname(configFileName),
			{},
			configFileName,
		);
		const resolver = new CompilerOptionsResolver(host.fileExists);

		for (const extendPath of [...extendedPaths].reverse()) {
			try {
				const configFile = ts.readJsonConfigFile(extendPath, host.readFile);
				const obj = ts.convertToObject(configFile, []);
				const rawOptions: RawVueCompilerOptions = obj?.vueCompilerOptions ?? {};
				resolver.addConfig(rawOptions, path.dirname(configFile.fileName));
			}
			catch {}
		}

		return {
			...parsed,
			vueOptions: resolver.build(),
		};
	}
	catch {}

	return {
		options: {},
		errors: [],
		vueOptions: getDefaultCompilerOptions(),
	};
}

export class CompilerOptionsResolver {
	options: Omit<RawVueCompilerOptions, 'target' | 'strictTemplates' | 'plugins'> = {};
	target: number | undefined;
	plugins: VueLanguagePlugin[] = [];

	constructor(
		public fileExists?: (path: string) => boolean,
	) {}

	addConfig(options: RawVueCompilerOptions, rootDir: string) {
		for (const key in options) {
			switch (key) {
				case 'target':
					if (options[key] === 'auto') {
						this.target = findVueVersion(rootDir);
					}
					else {
						this.target = options[key];
					}
					break;
				case 'strictTemplates':
					const strict = !!options.strictTemplates;
					this.options.strictVModel ??= strict;
					this.options.checkUnknownProps ??= strict;
					this.options.checkUnknownEvents ??= strict;
					this.options.checkUnknownDirectives ??= strict;
					this.options.checkUnknownComponents ??= strict;
					break;
				case 'plugins':
					this.plugins = (options.plugins ?? [])
						.flatMap<VueLanguagePlugin>((pluginPath: string) => {
							try {
								const resolvedPath = resolvePath(pluginPath, rootDir);
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
					break;
				default:
					// @ts-expect-error
					this.options[key] = options[key];
					break;
			}
		}
		if (options.target === undefined) {
			this.target ??= findVueVersion(rootDir);
		}
	}

	build(defaults = getDefaultCompilerOptions()) {
		const resolvedOptions: VueCompilerOptions = {
			...defaults,
			...this.options,
			target: this.target ?? defaults.target,
			plugins: this.plugins,
			macros: {
				...defaults.macros,
				...this.options.macros,
			},
			composables: {
				...defaults.composables,
				...this.options.composables,
			},
			fallthroughComponentNames: [
				...defaults.fallthroughComponentNames,
				...this.options.fallthroughComponentNames ?? [],
			].map(hyphenateTag),
			// https://github.com/vuejs/core/blob/master/packages/compiler-dom/src/transforms/vModel.ts#L49-L51
			// https://vuejs.org/guide/essentials/forms.html#form-input-bindings
			experimentalModelPropName: Object.fromEntries(
				Object.entries(
					this.options.experimentalModelPropName ?? defaults.experimentalModelPropName,
				).map(([k, v]) => [camelize(k), v]),
			),
		};

		return resolvedOptions;
	}
}

function findVueVersion(rootDir: string) {
	const resolvedPath = resolvePath('vue/package.json', rootDir);
	if (resolvedPath) {
		const vuePackageJson = require(resolvedPath);
		const versionNumbers = vuePackageJson.version.split('.');
		return Number(versionNumbers[0] + '.' + versionNumbers[1]);
	}
	else {
		// console.warn('Load vue/package.json failed from', folder);
	}
}

function resolvePath(scriptPath: string, root: string) {
	try {
		if ((require as NodeJS.Require | undefined)?.resolve) {
			return require.resolve(scriptPath, { paths: [root] });
		}
		else {
			// console.warn('failed to resolve path:', scriptPath, 'require.resolve is not supported in web');
		}
	}
	catch {
		// console.warn(error);
	}
}

export function getDefaultCompilerOptions(
	target = 99,
	lib = 'vue',
	strictTemplates = false,
	typesRoot = path.join(__dirname.replace(/\\/g, '/'), '..', 'types'),
): VueCompilerOptions {
	return {
		target,
		lib,
		typesRoot,
		extensions: ['.vue'],
		vitePressExtensions: [],
		petiteVueExtensions: [],
		jsxSlots: false,
		strictCssModules: false,
		strictVModel: strictTemplates,
		checkUnknownProps: strictTemplates,
		checkUnknownEvents: strictTemplates,
		checkUnknownDirectives: strictTemplates,
		checkUnknownComponents: strictTemplates,
		inferComponentDollarEl: false,
		inferComponentDollarRefs: false,
		inferTemplateDollarAttrs: false,
		inferTemplateDollarEl: false,
		inferTemplateDollarRefs: false,
		inferTemplateDollarSlots: false,
		skipTemplateCodegen: false,
		fallthroughAttributes: false,
		resolveStyleImports: false,
		resolveStyleClassNames: 'scoped',
		fallthroughComponentNames: [
			'Transition',
			'KeepAlive',
			'Teleport',
			'Suspense',
		],
		dataAttributes: [],
		htmlAttributes: ['aria-*'],
		optionsWrapper: [`(await import('${lib}')).defineComponent(`, `)`],
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
		experimentalModelPropName: {
			'': {
				input: true,
			},
			value: {
				input: { type: 'text' },
				textarea: true,
				select: true,
			},
		},
	};
}
