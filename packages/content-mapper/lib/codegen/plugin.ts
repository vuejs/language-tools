import type {
	IR,
	IRBlock,
	IRScript,
	IRScriptSetup,
	ScriptAnalysis,
	TypeScript,
	VueCompilerOptions,
	VuePluginContext,
	VuePluginError,
} from '@vue/language-core';

/** The `codegen` export of a `plugins` entry's module. */
export type VueCodegenExport = VueCodegenPlugin | ((ctx: VuePluginContext) => VueCodegenPlugin);

export interface VueCodegenPlugin {
	/**
	 * What the plugin adds to the TS code of one file. Re-run when what it reads changes. It must be a pure function of
	 * `file` and the plugin context: no file system, no environment, no cache shared across projects.
	 */
	contribute(file: VueCodegenFile): VueCodegenContribution | undefined;
}

export interface VueCodegenFile {
	/** The TS 7.1 AST API that parsed the IR's script ASTs. */
	ts: TypeScript;
	fileName: string;
	ir: IR;
	/** Resolved options (with SFC comment options), script and script-setup ranges, template scope. */
	analysis: ScriptAnalysis;
}

/** Code added by a contribution: plain text, which maps nowhere and never reports diagnostics, or text that maps to a source. */
export type VueCodegenCode = readonly (string | VueCodegenSourceText | VueCodegenSourceSpan)[];

/** `text` copied from `block` at `offset`; it must equal `block.content.slice(offset, offset + text.length)`. */
export interface VueCodegenSourceText {
	text: string;
	block: IRBlock;
	offset: number;
	features: number;
}

/** Generated `code` that maps as a whole to `start`..`end` of `block` (e.g. a diagnostic reported there). */
export interface VueCodegenSourceSpan {
	code: readonly (string | VueCodegenSourceText)[];
	block: IRBlock;
	start: number;
	end: number;
	features: number;
}

/** Replaces `start`..`end` of the content of `block` with `code`, or inserts it if `start === end`. */
export interface VueCodegenScriptEdit {
	block: IRScript | IRScriptSetup;
	start: number;
	end: number;
	code: VueCodegenCode;
}

export interface VueCodegenContribution {
	/** Edits of the user's code of `<script>` and `<script setup>`. */
	scriptEdits?: readonly VueCodegenScriptEdit[];
	/** Object types spread into the template context (what template expressions and `$` names resolve against). */
	templateContext?: readonly VueCodegenCode[];
	/** `<script setup>` only: object types intersected into the public props, in `defineProps<…>` form. */
	props?: readonly VueCodegenCode[];
	/** `<script setup>` only: object types `{ event: [args] }` intersected into the emits, in `defineEmits<…>` form. */
	emits?: readonly VueCodegenCode[];
	/** `<script setup>` only: object types intersected into what the component exposes, in `defineExpose` form. */
	expose?: readonly VueCodegenCode[];
	/** The tag → element type map of native elements, which replaces the DOM one in this file. */
	elements?: VueCodegenCode;
	/** Statements at module scope, after the user's code. */
	declarations?: readonly VueCodegenCode[];
	exports?: {
		/** Named exports of the component. */
		names?: readonly string[];
		/** `false` drops the synthetic default export. A user `export default` in `<script>` is user code and stays. */
		default?: boolean;
		/** A doc comment of the block, copied onto the component's export. */
		docComment?: { block: IRScript | IRScriptSetup; start: number; end: number };
	};
}

/** The `codegen` export of a `plugins` entry, created for the entry. */
export interface CodegenPlugin {
	/** The `name` of the entry. */
	name: string;
	plugin: VueCodegenPlugin;
}

/**
 * Creates the `codegen` export of each plugin of `vueCompilerOptions.plugins`, in order. An export that is not a
 * plugin, or a factory that throws, gives an error and is not loaded.
 */
export function loadCodegenPlugins(
	vueCompilerOptions: VueCompilerOptions,
): { plugins: CodegenPlugin[]; errors: VuePluginError[] } {
	const plugins: CodegenPlugin[] = [];
	const errors: VuePluginError[] = [];
	for (const { name, config, module } of vueCompilerOptions.plugins) {
		const codegen = typeof module === 'object' && module !== null
			? (module as { codegen?: unknown }).codegen
			: undefined;
		if (codegen === undefined) {
			continue;
		}
		if (typeof codegen !== 'function' && (typeof codegen !== 'object' || codegen === null)) {
			errors.push({ plugin: name, message: 'The `codegen` export must be an object or a function.' });
			continue;
		}
		let plugin: unknown;
		try {
			plugin = typeof codegen === 'function'
				? codegen({ config, vueCompilerOptions } satisfies VuePluginContext)
				: codegen;
		}
		catch (error) {
			errors.push({ plugin: name, message: `Failed to create the \`codegen\` export: ${error}` });
			continue;
		}
		if (typeof (plugin as Partial<VueCodegenPlugin> | null | undefined)?.contribute !== 'function') {
			errors.push({ plugin: name, message: 'The `contribute` of the `codegen` export must be a function.' });
			continue;
		}
		plugins.push({ name, plugin: plugin as VueCodegenPlugin });
	}
	return { plugins, errors };
}
