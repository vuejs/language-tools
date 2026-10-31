import { camelize } from '@vue/shared';
import { posix as path } from 'path-browserify';
import picomatch from 'picomatch';
import { hyphenateTag } from '../names';
import type { RawPlugin, RawVueCompilerOptions, ResolvedVuePlugin, VueCompilerOptions, VuePluginError } from '../types';
import { getDefaultTypesRoot } from '../typesRoot';
import { resolvePluginMacros } from './plugins';

export class CompilerOptionsResolver {
	options: Omit<RawVueCompilerOptions, 'target' | 'typesRoot' | 'plugins'> = {};
	target: number | undefined;
	typesRoot: string | undefined;
	plugins: ResolvedVuePlugin[] = [];
	/** The files of `plugins` and the entries that fail to load, and the `package.json` of each plugin package. */
	pluginFiles: string[] = [];
	/** The entries of `plugins` that fail to load. */
	pluginErrors: VuePluginError[] = [];

	constructor(
		public readFile: (fileName: string) => string | undefined,
	) {}

	addConfig(options: RawVueCompilerOptions, rootDir: string) {
		for (const key in options) {
			switch (key) {
				case 'target':
					if (options[key] === 'auto') {
						this.target = this.resolveVueVersion(rootDir);
					}
					else {
						this.target = options[key];
					}
					break;
				case 'typesRoot':
					if (options[key] !== undefined) {
						if (path.isAbsolute(options[key])) {
							this.typesRoot = options[key];
						}
						else {
							this.typesRoot = path.join(rootDir, options[key]);
						}
					}
					break;
				case 'plugins':
					// A config that declares `plugins` replaces the inherited list; `[]` clears it
					if (options.plugins) {
						({ plugins: this.plugins, files: this.pluginFiles, errors: this.pluginErrors } = resolveVuePlugins(
							options.plugins,
							rootDir,
							this.readFile,
						));
					}
					break;
				default:
					// @ts-expect-error
					this.options[key] = options[key];
					break;
			}
		}
		if (options.target === undefined) {
			this.target ??= this.resolveVueVersion(rootDir);
		}
	}

	build(
		defaults = getDefaultCompilerOptions(
			this.target,
			this.options.lib,
			this.typesRoot,
		),
	): VueCompilerOptions {
		const resolvedOptions: VueCompilerOptions = {
			...defaults,
			...this.options,
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
			// a later entry of the same normalized tag wins, so the project overrides the defaults
			// and an SFC root comment overrides the project
			vModelPropName: Object.fromEntries(
				Object.entries({
					...defaults.vModelPropName,
					...this.options.vModelPropName,
				}).flatMap(([tag, prop]): [string, string | false][] =>
					// other values, such as the prop-keyed shape of `experimentalModelPropName`, are left to the
					// option diagnostics of the host
					prop === false || typeof prop === 'string' ? [[hyphenateTag(tag), prop && camelize(prop)]] : []
				),
			),
		};
		// Compiling a glob costs far more than testing it, and codegen tests every prop against these
		resolvedOptions.isDataAttribute = picomatch(resolvedOptions.dataAttributes);
		resolvedOptions.isHtmlAttribute = picomatch(resolvedOptions.htmlAttributes);
		resolvedOptions.macros = resolvePluginMacros(resolvedOptions);

		return resolvedOptions;
	}

	resolveVueVersion(folder: string): number | undefined {
		for (let dir = folder;; dir = path.dirname(dir)) {
			const packageJsonContent = this.readFile(path.join(dir, 'node_modules/vue/package.json'));
			if (packageJsonContent) {
				const version: string = JSON.parse(packageJsonContent).version;
				const [majorVersion, minorVersion] = version.split('.');
				return Number(majorVersion + '.' + minorVersion);
			}
			if (path.dirname(dir) === dir) {
				return;
			}
		}
	}
}

/**
 * The Vue compiler options of one TS 7.1 `contentMappers` entry, read from its `options` relative to `rootDir`.
 * Keys that are not Vue compiler options, such as a Content Mapper's own settings, have no effect.
 * The files of the `plugins`, as `resolveVuePlugins` lists them, are added to `pluginFiles`, and the entries that fail
 * to load to `pluginErrors`.
 */
export function resolveVueCompilerOptions(
	readFile: (fileName: string) => string | undefined,
	rootDir: string,
	options: RawVueCompilerOptions = {},
	pluginFiles?: string[],
	pluginErrors?: VuePluginError[],
) {
	const resolver = new CompilerOptionsResolver(readFile);
	resolver.addConfig(options, rootDir);
	pluginFiles?.push(...resolver.pluginFiles);
	pluginErrors?.push(...resolver.pluginErrors);
	const vueOptions = resolver.build();
	if (vueOptions.format === 'petite-vue') {
		vueOptions.globalTemplateContext = true;
	}
	return vueOptions;
}

/**
 * Resolves the `plugins` entries relative to `rootDir` and loads their modules. `files` lists every file that an
 * entry resolves to, including the ones that fail to load, and the `package.json` of each plugin package; `errors`
 * lists the entries that fail to load.
 */
export function resolveVuePlugins(
	list: RawPlugin[],
	rootDir: string,
	readFile: (fileName: string) => string | undefined,
) {
	const plugins: ResolvedVuePlugin[] = [];
	const files: string[] = [];
	const errors: VuePluginError[] = [];
	for (const raw of list) {
		const { name, ...config } = typeof raw === 'string' ? { name: raw } : raw;
		let file: string | undefined;
		try {
			file = (require as NodeJS.Require | undefined)?.resolve(name, { paths: [rootDir] });
		}
		catch {}
		if (!file) {
			errors.push({ plugin: name, message: `Cannot find the plugin from '${rootDir}'.` });
			continue;
		}
		files.push(file);
		const packageJson = findPackageJson(name, file, readFile);
		if (packageJson) {
			files.push(packageJson.file);
		}
		try {
			// Loaded again on every resolve, so a host that resolves again after the file changes gets its new exports;
			// the modules that it requires are still cached
			delete (require as NodeJS.Require | undefined)?.cache[file];
			plugins.push({ name, file, packageJson, config, module: require(file) });
		}
		catch (error) {
			errors.push({ plugin: name, message: `Failed to load '${file}': ${error}` });
		}
	}
	return { plugins, files, errors };
}

/** The `package.json` of the package that a bare specifier `name` names, found up from `file`. */
function findPackageJson(
	name: string,
	file: string,
	readFile: (fileName: string) => string | undefined,
): ResolvedVuePlugin['packageJson'] {
	if (name.startsWith('.') || path.isAbsolute(name.replace(/\\/g, '/'))) {
		return;
	}
	const segments = name.split('/');
	const packageName = segments.slice(0, name.startsWith('@') ? 2 : 1).join('/');
	for (let dir = path.dirname(file.replace(/\\/g, '/'));; dir = path.dirname(dir)) {
		const fileName = path.join(dir, 'package.json');
		const content = readFile(fileName);
		if (content !== undefined) {
			try {
				const { name, version } = JSON.parse(content);
				if (name === packageName) {
					return { file: fileName, name, version };
				}
			}
			catch {}
		}
		if (path.dirname(dir) === dir) {
			return;
		}
	}
}

export function getDefaultCompilerOptions(
	target = 99,
	lib = 'vue',
	typesRoot = getDefaultTypesRoot(),
): VueCompilerOptions {
	const dataAttributes: string[] = [];
	const htmlAttributes = ['aria-*'];

	return {
		target,
		lib,
		typesRoot,
		format: 'sfc',
		globalTemplateContext: false,
		jsxSlots: false,
		strictCssModules: false,
		inferComponentDollarEl: false,
		inferComponentDollarRefs: false,
		inferTemplateDollarAttrs: false,
		inferTemplateDollarEl: false,
		inferTemplateDollarRefs: false,
		inferTemplateDollarSlots: false,
		vapor: false,
		fallthroughAttributes: false,
		checkRequiredFallthroughAttributes: false,
		resolveStyleClassNames: 'scoped',
		fallthroughComponentNames: [
			'Transition',
			'KeepAlive',
			'Teleport',
			'Suspense',
		],
		dataAttributes,
		htmlAttributes,
		isDataAttribute: picomatch(dataAttributes),
		isHtmlAttribute: picomatch(htmlAttributes),
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
		vModelPropName: {},
	};
}
