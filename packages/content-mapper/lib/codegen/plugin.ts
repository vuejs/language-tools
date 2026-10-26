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
import { Boundary, type TsCode } from '../boundary';

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

/** The contributions of the codegen plugins to one file, combined in `plugins` order and turned into code. */
export interface CodegenContributions {
	scriptEdits: ScriptEdit[];
	/** Object types spread into the template context. */
	templateContext: TsCode[][];
	/** Object types intersected into the public props of a script setup component. */
	props: TsCode[][];
	/** Object types of events intersected into the emits of a script setup component. */
	emits: TsCode[][];
	/** Object types intersected into what a script setup component exposes. */
	expose: TsCode[][];
}

export interface ScriptEdit {
	/** The `name` of the plugin entry. */
	plugin: string;
	block: IRScript | IRScriptSetup;
	start: number;
	end: number;
	code: TsCode[];
}

/**
 * Collects what each plugin contributes to `file`, in order. An exception of `contribute` propagates. Entries that
 * are not valid for the IR of the file are dropped.
 */
export function getContributions(plugins: readonly CodegenPlugin[], file: VueCodegenFile): CodegenContributions {
	const { ir } = file;
	const blocks = new Set<IRBlock>(
		[ir.template, ir.script, ir.scriptSetup, ...ir.styles, ...ir.customBlocks].filter(block => !!block),
	);
	const contributions: CodegenContributions = {
		scriptEdits: [],
		templateContext: [],
		props: [],
		emits: [],
		expose: [],
	};
	for (const { name, plugin } of plugins) {
		const contribution = plugin.contribute(file);
		if (typeof contribution !== 'object' || contribution === null) {
			continue;
		}
		for (const edit of toArray(contribution.scriptEdits)) {
			if (typeof edit !== 'object' || edit === null) {
				continue;
			}
			const { block, start, end } = edit;
			if ((block === ir.script || block === ir.scriptSetup) && block && isRange(block, start, end)) {
				contributions.scriptEdits.push({ plugin: name, block, start, end, code: toTsCode(blocks, edit.code) });
			}
		}
		for (const key of ['templateContext', 'props', 'emits', 'expose'] as const) {
			for (const type of toArray(contribution[key])) {
				contributions[key].push(toTsCode(blocks, type));
			}
		}
	}
	return contributions;
}

/**
 * The code of `code`. A `SourceText` whose text is not the text of the source at its offset, and a `SourceSpan` out of
 * the range of its source, keep their text but do not map.
 */
function toTsCode(blocks: Set<IRBlock>, code: VueCodegenCode | undefined): TsCode[] {
	return [...generateCode(blocks, code)];
}

function* generateCode(blocks: Set<IRBlock>, code: VueCodegenCode | undefined): Generator<TsCode> {
	for (const segment of toArray(code)) {
		if (typeof segment === 'string') {
			yield segment;
		}
		else if (typeof segment !== 'object' || segment === null) {
			continue;
		}
		else if ('code' in segment) {
			const { block, start, end, features } = segment;
			if (blocks.has(block) && isRange(block, start, end) && typeof features === 'number') {
				const boundary = yield* Boundary.start(block.name, start, end, { features });
				yield* generateCode(blocks, segment.code);
				yield boundary.end();
			}
			else {
				yield* generateCode(blocks, segment.code);
			}
		}
		else if (typeof segment.text === 'string') {
			const { text, block, offset, features } = segment;
			if (
				blocks.has(block)
				&& isRange(block, offset, offset + text.length)
				&& typeof features === 'number'
				&& block.content.slice(offset, offset + text.length) === text
			) {
				yield [text, block.name, offset, { features }];
			}
			else {
				yield text;
			}
		}
	}
}

function isRange(block: IRBlock, start: unknown, end: unknown): boolean {
	return Number.isInteger(start) && Number.isInteger(end)
		&& 0 <= (start as number) && (start as number) <= (end as number) && (end as number) <= block.content.length;
}

function toArray<T>(value: readonly T[] | undefined): readonly T[] {
	return Array.isArray(value) ? value : [];
}
