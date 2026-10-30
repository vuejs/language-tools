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
import { generatePiece, type Piece } from './piece';
import type { TsCode } from './tsCode';
import { identifierRE } from './writers';

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

/**
 * A piece of code added by a contribution: plain text, which maps nowhere and never reports diagnostics, or the range
 * `start`..`end` of `source`, an IR block, mapped with `data.features`. A range without `text` copies the block's text
 * there; with `text`, the text maps to the range as a whole (e.g. a diagnostic reported there).
 */
export type VueCodegenPiece = Piece<IRBlock, { features: number }>;

export type VueCodegenCode = readonly VueCodegenPiece[];

/** `code` right before the text of `block` that starts at `insertBefore`; it goes wherever that text goes. */
export interface VueCodegenScriptInsertBefore {
	block: IRScript | IRScriptSetup;
	insertBefore: number;
	code: VueCodegenCode;
}

/** `code` right after the text of `block` that ends at `insertAfter`; it goes wherever that text goes. */
export interface VueCodegenScriptInsertAfter {
	block: IRScript | IRScriptSetup;
	insertAfter: number;
	code: VueCodegenCode;
}

/** The text of `block` at `replace.start`..`replace.end` (not empty) is not copied; `code` takes its place. */
export interface VueCodegenScriptReplace {
	block: IRScript | IRScriptSetup;
	replace: { start: number; end: number };
	code: VueCodegenCode;
}

/** An edit of the content of `block`, at offsets of the content. */
export type VueCodegenScriptEdit = VueCodegenScriptInsertBefore | VueCodegenScriptInsertAfter | VueCodegenScriptReplace;

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
	/** The tag → element type map of native elements, of the first plugin that sets one. */
	elements: TsCode[] | undefined;
	/** Statements at module scope. */
	declarations: TsCode[][];
	exports: {
		/** Named exports of the component, de-duplicated. */
		names: string[];
		/** Whether the synthetic default export is kept, of the first plugin that sets it. */
		default: boolean;
		/** The text of a doc comment of the component, of the first plugin that sets a valid one. */
		docComment: string | undefined;
	};
}

export type ScriptEdit =
	& {
		/** The index of the plugin in `plugins`: the edits of a later plugin sit outside those of an earlier one. */
		pluginIndex: number;
		block: IRScript | IRScriptSetup;
		code: TsCode[];
	}
	& (
		| { kind: 'insertBefore' | 'insertAfter'; offset: number }
		| { kind: 'replace'; start: number; end: number }
	);

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
		elements: undefined,
		declarations: [],
		exports: { names: [], default: true, docComment: undefined },
	};
	let isDefaultSet = false;
	for (const [pluginIndex, { plugin }] of plugins.entries()) {
		const contribution = plugin.contribute(file);
		if (typeof contribution !== 'object' || contribution === null) {
			continue;
		}
		for (const edit of toArray(contribution.scriptEdits)) {
			const scriptEdit = toScriptEdit(ir, edit, pluginIndex);
			if (scriptEdit) {
				scriptEdit.code = toTsCode(blocks, edit.code);
				contributions.scriptEdits.push(scriptEdit);
			}
		}
		if (!contributions.elements && toArray(contribution.elements).length) {
			contributions.elements = toTsCode(blocks, contribution.elements);
		}
		for (const key of ['templateContext', 'props', 'emits', 'expose', 'declarations'] as const) {
			for (const type of toArray(contribution[key])) {
				contributions[key].push(toTsCode(blocks, type));
			}
		}
		const { exports } = contribution;
		if (typeof exports !== 'object' || exports === null) {
			continue;
		}
		for (const exportName of toArray(exports.names)) {
			if (
				typeof exportName === 'string' && identifierRE.test(exportName)
				&& !contributions.exports.names.includes(exportName)
			) {
				contributions.exports.names.push(exportName);
			}
		}
		if (!isDefaultSet && typeof exports.default === 'boolean') {
			isDefaultSet = true;
			contributions.exports.default = exports.default;
		}
		if (
			contributions.exports.docComment === undefined && typeof exports.docComment === 'object' && exports.docComment
		) {
			const { block, start, end } = exports.docComment;
			if ((block === ir.script || block === ir.scriptSetup) && block && isRange(block, start, end)) {
				const text = block.content.slice(start, end);
				// one block comment, so that it can't end the generated code's own comments or add code
				if (/^\/\*(?:[^*]|\*(?!\/))*\*\/$/.test(text)) {
					contributions.exports.docComment = text;
				}
			}
		}
	}
	return contributions;
}

/** The script edit of `edit`, if it has exactly one of its keys, with offsets in the content of a script block of `ir`. */
function toScriptEdit(ir: IR, edit: VueCodegenScriptEdit, pluginIndex: number): ScriptEdit | undefined {
	if (typeof edit !== 'object' || edit === null) {
		return;
	}
	const { block, insertBefore, insertAfter, replace } = edit as Partial<
		VueCodegenScriptInsertBefore & VueCodegenScriptInsertAfter & VueCodegenScriptReplace
	>;
	if ((block !== ir.script && block !== ir.scriptSetup) || !block) {
		return;
	}
	if ([insertBefore, insertAfter, replace].filter(key => key !== undefined).length !== 1) {
		return;
	}
	if (replace === undefined) {
		const offset = insertBefore ?? insertAfter!;
		if (isRange(block, offset, offset)) {
			return {
				pluginIndex,
				block,
				code: [],
				kind: insertBefore !== undefined ? 'insertBefore' : 'insertAfter',
				offset,
			};
		}
		return;
	}
	const { start, end } = typeof replace === 'object' && replace !== null ? replace : { start: 0, end: 0 };
	if (isRange(block, start, end) && start < end) {
		return { pluginIndex, block, code: [], kind: 'replace', start, end };
	}
}

/** The code of `code`. A range of a block that is not the file's or out of its block keeps only its text. */
function toTsCode(blocks: Set<IRBlock>, code: VueCodegenCode | undefined): TsCode[] {
	const codes: TsCode[] = [];
	for (const piece of toArray(code)) {
		if (typeof piece === 'string') {
			codes.push(...generatePiece(piece));
		}
		else if (typeof piece === 'object' && piece !== null) {
			const { source, start, end, data, text } = piece;
			if (blocks.has(source) && isRange(source, start, end) && typeof data?.features === 'number') {
				codes.push(...generatePiece({ source, start, end, data: { features: data.features }, text }));
			}
			else if (typeof text === 'string') {
				codes.push(...generatePiece(text));
			}
		}
	}
	return codes;
}

function isRange(block: IRBlock, start: unknown, end: unknown): boolean {
	return Number.isInteger(start) && Number.isInteger(end)
		&& 0 <= (start as number) && (start as number) <= (end as number) && (end as number) <= block.content.length;
}

function toArray<T>(value: readonly T[] | undefined): readonly T[] {
	return Array.isArray(value) ? value : [];
}
