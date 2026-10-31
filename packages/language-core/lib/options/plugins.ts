import type * as CompilerDOM from '@vue/compiler-dom';
import type {
	VueCompilerOptions,
	VueFormat,
	VueIRPlugin,
	VuePluginContext,
	VuePluginError,
	VuePluginModule,
} from '../types';

export const legacyPluginMessage =
	'VueLanguagePlugin functions are no longer supported; export `{ ir: … }` (see language-core README)';

/** The IR contributions of the plugins of `vueCompilerOptions.plugins`, keyed by what they provide. */
export interface IRPlugins {
	formats: Record<string, VueFormat>;
	templateCompilers: Record<string, NonNullable<VueIRPlugin['templateCompilers']>[string]>;
	resolveTemplateCompilerOptions: ((options: CompilerDOM.CompilerOptions) => CompilerDOM.CompilerOptions)[];
	/** The entries, or the parts of them, that have no effect. */
	errors: VuePluginError[];
}

/**
 * Loads the `ir` export of each plugin of `vueCompilerOptions.plugins`, in order. A format or template language that
 * is in `builtIn`, or that an earlier plugin provides, is not loaded and gives an error.
 */
export function loadIRPlugins(
	vueCompilerOptions: VueCompilerOptions,
	builtIn: { formats: readonly string[]; templateCompilers: readonly string[] },
): IRPlugins {
	const loaded: IRPlugins = {
		formats: {},
		templateCompilers: {},
		resolveTemplateCompilerOptions: [],
		errors: [],
	};
	const formatOwners = new Map<string, string>();
	const templateCompilerOwners = new Map<string, string>();

	for (const { name, plugin, error } of createIRPlugins(vueCompilerOptions)) {
		if (error !== undefined) {
			loaded.errors.push({ plugin: name, message: error });
			continue;
		}
		if (!plugin) {
			continue;
		}
		for (const message of readMacros(plugin, vueCompilerOptions).errors) {
			loaded.errors.push({ plugin: name, message });
		}
		claim('format', plugin.formats, builtIn.formats, formatOwners, loaded.formats);
		claim(
			'template compiler',
			plugin.templateCompilers,
			builtIn.templateCompilers,
			templateCompilerOwners,
			loaded.templateCompilers,
		);
		if (plugin.resolveTemplateCompilerOptions) {
			loaded.resolveTemplateCompilerOptions.push(options => plugin.resolveTemplateCompilerOptions!(options));
		}

		function claim<T>(
			kind: string,
			provided: Record<string, T> | undefined,
			builtInKeys: readonly string[],
			owners: Map<string, string>,
			target: Record<string, T>,
		) {
			for (const key in provided) {
				const owner = owners.get(key);
				if (builtInKeys.includes(key)) {
					loaded.errors.push({ plugin: name, message: `The ${kind} '${key}' is built in and cannot be replaced.` });
				}
				else if (owner !== undefined) {
					loaded.errors.push({ plugin: name, message: `The ${kind} '${key}' is already provided by '${owner}'.` });
				}
				else {
					owners.set(key, name);
					target[key] = provided[key]!;
				}
			}
		}
	}

	return loaded;
}

/**
 * The macros of `vueCompilerOptions` with the calls that the `ir` exports of its plugins add to each, in `plugins`
 * order.
 */
export function resolvePluginMacros(vueCompilerOptions: VueCompilerOptions): VueCompilerOptions['macros'] {
	const macros = { ...vueCompilerOptions.macros };
	for (const { plugin } of createIRPlugins(vueCompilerOptions)) {
		if (plugin) {
			for (const [key, names] of readMacros(plugin, vueCompilerOptions).macros) {
				macros[key] = [...new Set([...macros[key], ...names])];
			}
		}
	}
	return macros;
}

interface IRPluginInstance {
	name: string;
	plugin?: VueIRPlugin;
	/** Why the entry has no effect. */
	error?: string;
}

const instances = new WeakMap<VueCompilerOptions['plugins'], IRPluginInstance[]>();

/**
 * The `ir` export of each plugin of `vueCompilerOptions`, created once for its `plugins`, with the options that first
 * read them: the options of an SFC comment share the plugins of their project.
 */
function createIRPlugins(vueCompilerOptions: VueCompilerOptions) {
	let created = instances.get(vueCompilerOptions.plugins);
	if (!created) {
		created = vueCompilerOptions.plugins.map(({ name, config, module }): IRPluginInstance => {
			if (isLegacyPlugin(module)) {
				return { name, error: legacyPluginMessage };
			}
			const ir = (module as VuePluginModule | undefined)?.ir;
			try {
				return {
					name,
					plugin: typeof ir === 'function'
						? ir({ config, vueCompilerOptions } satisfies VuePluginContext)
						: ir,
				};
			}
			catch (error) {
				return { name, error: `Failed to create the \`ir\` export: ${error}` };
			}
		});
		instances.set(vueCompilerOptions.plugins, created);
	}
	return created;
}

/** The `macros` of `plugin` that name a macro of `vueCompilerOptions` with a list of calls, and why the others do not. */
function readMacros(plugin: VueIRPlugin, vueCompilerOptions: VueCompilerOptions) {
	const macros: [keyof VueCompilerOptions['macros'], string[]][] = [];
	const errors: string[] = [];
	for (const key in plugin.macros) {
		const names: unknown = plugin.macros[key as keyof VueCompilerOptions['macros']];
		if (!Object.hasOwn(vueCompilerOptions.macros, key)) {
			errors.push(`'${key}' is not a macro.`);
		}
		else if (!Array.isArray(names) || names.some(name => typeof name !== 'string')) {
			errors.push(`The calls of the macro '${key}' are not a list of names.`);
		}
		else {
			macros.push([key as keyof VueCompilerOptions['macros'], names]);
		}
	}
	return { macros, errors };
}

function isLegacyPlugin(module: unknown) {
	return typeof module === 'function'
		|| Array.isArray(module)
		|| (typeof module === 'object' && module !== null && 'version' in module);
}
