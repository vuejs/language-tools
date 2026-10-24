import { camelize } from '@vue/shared';
import { posix as path } from 'path-browserify';
import picomatch from 'picomatch';
import type { RawPlugin, RawVueCompilerOptions, VueCompilerOptions, VueLanguagePlugin } from './types';
import { hyphenateTag } from './utils/shared';

export class CompilerOptionsResolver {
	options: Omit<RawVueCompilerOptions, 'target' | 'typesRoot' | 'plugins'> = {};
	target: number | undefined;
	typesRoot: string | undefined;
	plugins: VueLanguagePlugin[] = [];

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
						this.plugins = resolvePlugins(options.plugins, rootDir);
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
					// other values, such as the prop-keyed shape of `experimentalModelPropName`, are reported by the
					// content mapper's option diagnostics
					prop === false || typeof prop === 'string' ? [[hyphenateTag(tag), prop && camelize(prop)]] : []
				),
			),
		};
		// Compiling a glob costs far more than testing it, and codegen tests every prop against these
		resolvedOptions.isDataAttribute = picomatch(resolvedOptions.dataAttributes);
		resolvedOptions.isHtmlAttribute = picomatch(resolvedOptions.htmlAttributes);

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

function resolvePlugins(list: RawPlugin[], rootDir: string): VueLanguagePlugin[] {
	const plugins: VueLanguagePlugin[] = [];
	for (let raw of list) {
		raw = typeof raw === 'string' ? { name: raw } : raw;
		try {
			const resolve = (require as NodeJS.Require | undefined)?.resolve;
			const resolvedPath = resolve?.(raw.name, { paths: [rootDir] });
			if (resolvedPath) {
				const moduleExports = require(resolvedPath);
				for (const plugin of Array.isArray(moduleExports) ? moduleExports : [moduleExports]) {
					plugin.__moduleConfig = raw;
					plugins.push(plugin);
				}
			}
			else {
				console.warn('[Vue] Load plugin failed:', raw.name);
			}
		}
		catch (error) {
			console.warn('[Vue] Resolve plugin path failed:', raw.name, error);
		}
	}
	return plugins;
}

export function getDefaultCompilerOptions(
	target = 99,
	lib = 'vue',
	typesRoot = typeof __dirname !== 'undefined'
		? path.join(__dirname.replace(/\\/g, '/'), '..', 'types')
		: '@vue/language-core/types',
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
		skipTemplateCodegen: false,
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
