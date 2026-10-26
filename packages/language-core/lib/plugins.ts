import type * as CompilerDOM from '@vue/compiler-dom';
import type {
	VueCompilerOptions,
	VueFormat,
	VueIRPlugin,
	VuePluginContext,
	VuePluginError,
	VuePluginModule,
} from './types';

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

	for (const { name, config, module } of vueCompilerOptions.plugins) {
		if (isLegacyPlugin(module)) {
			loaded.errors.push({ plugin: name, message: legacyPluginMessage });
			continue;
		}
		const ir = (module as VuePluginModule | undefined)?.ir;
		if (!ir) {
			continue;
		}
		let plugin: VueIRPlugin;
		try {
			plugin = typeof ir === 'function'
				? ir({ config, vueCompilerOptions } satisfies VuePluginContext)
				: ir;
		}
		catch (error) {
			loaded.errors.push({ plugin: name, message: `Failed to create the \`ir\` export: ${error}` });
			continue;
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

function isLegacyPlugin(module: unknown) {
	return typeof module === 'function'
		|| Array.isArray(module)
		|| (typeof module === 'object' && module !== null && 'version' in module);
}
