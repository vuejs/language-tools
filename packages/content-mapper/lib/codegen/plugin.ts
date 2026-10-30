import {
	type IR,
	type IRBlock,
	type IRScript,
	type IRScriptSetup,
	type ScriptAnalysis,
	scriptFeatures,
	type TypeScript,
	type VueCompilerOptions,
	type VuePluginContext,
	type VuePluginError,
} from '@vue/language-core';
import type { Piece, RewriteCode, RewriteSlice } from 'muggle-string';
import type { BlockRewrite, BlockWriter } from './rewrite/blockRewrite';
import { identifierRE } from './writers';

/** The `codegen` export of a `plugins` entry's module. */
export type VueCodegenExport = VueCodegenPlugin | ((ctx: VuePluginContext) => VueCodegenPlugin);

/**
 * A codegen plugin. For each file, the `rewrite` of every plugin runs in `plugins` order, and so does the `generate` of
 * every plugin. Both must be pure functions of `file` and the plugin context: no file system, no environment, no cache
 * shared across projects.
 */
export interface VueCodegenPlugin {
	/** Edits the user's code of `<script>` and `<script setup>` through the writer of each block. */
	rewrite?(file: VueCodegenFile, writers: VueCodegenWriters): void;
	/** What the plugin adds to the slots of the TS code of the file. */
	generate?(file: VueCodegenFile): VueCodegenSlots | undefined;
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
 * there; `text` maps to the range char by char when it is as long as the range, and as a whole otherwise (e.g. a
 * diagnostic reported there).
 */
export type VueCodegenPiece = Piece<IRBlock, VueCodegenData>;

export interface VueCodegenData {
	features: number;
}

export type VueCodegenCode = readonly VueCodegenPiece[];

/** A range that a writer cut from its block, with the edits in it; it renders where it is inserted, exactly once. */
export type VueCodegenSlice = RewriteSlice<IRBlock, VueCodegenData>;

/** Code that a writer inserts: pieces, slices, and arrays of them. */
export type VueCodegenInsert = RewriteCode<IRBlock, VueCodegenData>;

/** The writers of the script blocks of the file, for one plugin. */
export interface VueCodegenWriters {
	script: VueCodegenWriter | undefined;
	scriptSetup: VueCodegenWriter | undefined;
}

/**
 * Edits of the content of one script block, at offsets of the content. An edit out of the range of the block, a removal
 * of no char, and code that is not text, a range of a block of the file or a slice throw.
 */
export interface VueCodegenWriter {
	/** `code` right before the char at `offset`; it goes wherever that char goes. */
	insertBefore(offset: number, code: VueCodegenInsert): void;
	/** `code` right after the char before `offset`; it goes wherever that char goes. */
	insertAfter(offset: number, code: VueCodegenInsert): void;
	/** The chars of `start`..`end` are not copied. */
	remove(start: number, end: number): void;
	/**
	 * The chars of `start`..`end`, with the edits of all writers in them, rendered where the slice is inserted, exactly
	 * once; nowhere if it is not. The cuts of all writers are nested or disjoint.
	 */
	cut(start: number, end: number): VueCodegenSlice;
}

export interface VueCodegenSlots {
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
		const { rewrite, generate } = (plugin ?? {}) as Partial<VueCodegenPlugin>;
		if (rewrite === undefined && generate === undefined) {
			errors.push({ plugin: name, message: 'The `codegen` export must have a `rewrite` or a `generate` function.' });
			continue;
		}
		const nonFunction = ([['rewrite', rewrite], ['generate', generate]] as const)
			.find(([, hook]) => hook !== undefined && typeof hook !== 'function');
		if (nonFunction) {
			errors.push({ plugin: name, message: `The \`${nonFunction[0]}\` of the \`codegen\` export must be a function.` });
			continue;
		}
		plugins.push({ name, plugin: plugin as VueCodegenPlugin });
	}
	return { plugins, errors };
}

/** The contributions of the codegen plugins to one file, combined in `plugins` order. */
export interface CodegenContributions {
	/** Object types spread into the template context. */
	templateContext: VueCodegenCode[];
	/** Object types intersected into the public props of a script setup component. */
	props: VueCodegenCode[];
	/** Object types of events intersected into the emits of a script setup component. */
	emits: VueCodegenCode[];
	/** Object types intersected into what a script setup component exposes. */
	expose: VueCodegenCode[];
	/** The tag → element type map of native elements, of the first plugin that sets one. */
	elements: VueCodegenCode | undefined;
	/** Statements at module scope. */
	declarations: VueCodegenCode[];
	exports: {
		/** Named exports of the component, de-duplicated. */
		names: string[];
		/** Whether the synthetic default export is kept, of the first plugin that sets it. */
		default: boolean;
		/** The text of a doc comment of the component, of the first plugin that sets a valid one. */
		docComment: string | undefined;
	};
}

/** The rewrites of the script blocks of a file. */
export interface ScriptRewrites {
	script: BlockRewrite | undefined;
	scriptSetup: BlockRewrite | undefined;
}

/**
 * Runs the `rewrite` of each plugin on `file`, in order, with its writers of `rewrites`. An exception of a hook
 * propagates, and so does an edit that is not valid for the IR of the file.
 */
export function rewriteScripts(plugins: readonly CodegenPlugin[], file: VueCodegenFile, rewrites: ScriptRewrites) {
	const blocks = getBlocks(file.ir);
	for (const [rank, { name, plugin }] of plugins.entries()) {
		plugin.rewrite?.(file, {
			script: rewrites.script && createWriter(name, blocks, rewrites.script.rewrite.writer(rank)),
			scriptSetup: rewrites.scriptSetup && createWriter(name, blocks, rewrites.scriptSetup.rewrite.writer(rank)),
		});
	}
}

/**
 * Runs the `generate` of each plugin on `file`, in order. An exception of a hook propagates, and so does a piece that
 * is not valid for the IR of the file. Other entries that are not valid for the IR of the file are dropped.
 */
export function getContributions(plugins: readonly CodegenPlugin[], file: VueCodegenFile): CodegenContributions {
	const { ir } = file;
	const blocks = getBlocks(ir);
	const contributions: CodegenContributions = {
		templateContext: [],
		props: [],
		emits: [],
		expose: [],
		elements: undefined,
		declarations: [],
		exports: { names: [], default: true, docComment: undefined },
	};
	let isDefaultSet = false;
	for (const { name, plugin } of plugins) {
		const contribution = plugin.generate?.(file);
		if (typeof contribution !== 'object' || contribution === null) {
			continue;
		}
		if (!contributions.elements && toArray(contribution.elements).length) {
			contributions.elements = checkCode(name, blocks, contribution.elements!);
		}
		for (const key of ['templateContext', 'props', 'emits', 'expose', 'declarations'] as const) {
			for (const type of toArray(contribution[key])) {
				contributions[key].push(checkCode(name, blocks, type));
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

function getBlocks(ir: IR): Set<IRBlock> {
	return new Set([ir.template, ir.script, ir.scriptSetup, ...ir.styles, ...ir.customBlocks].filter(block => !!block));
}

/** The writer of `plugin` that edits through `writer` the code that it checks. */
function createWriter(plugin: string, blocks: Set<IRBlock>, writer: BlockWriter): VueCodegenWriter {
	return {
		insertBefore(offset, code) {
			writer.insertBefore(offset, checkInsert(plugin, blocks, code));
		},
		insertAfter(offset, code) {
			writer.insertAfter(offset, checkInsert(plugin, blocks, code));
		},
		remove(start, end) {
			writer.replace(start, end, '');
		},
		cut(start, end) {
			// the data of the kept pieces only, which the slice does not let the plugin read
			return writer.cut(start, end, { data: { features: scriptFeatures } }) as VueCodegenSlice;
		},
	};
}

/** `code`, which throws if a part of it is not a piece of `checkCode` or a slice. */
function checkInsert(plugin: string, blocks: Set<IRBlock>, code: VueCodegenInsert): VueCodegenInsert {
	if (Array.isArray(code)) {
		for (const part of code as readonly VueCodegenInsert[]) {
			checkInsert(plugin, blocks, part);
		}
	}
	else if (!isSlice(code)) {
		checkPiece(plugin, blocks, code as VueCodegenPiece);
	}
	return code;
}

function isSlice(code: VueCodegenInsert): code is VueCodegenSlice {
	return typeof code === 'object' && code !== null && typeof (code as VueCodegenSlice).pieces === 'function';
}

/** `code`, which throws if a piece of it is not text or a range of a block of the file mapped with features. */
function checkCode(plugin: string, blocks: Set<IRBlock>, code: VueCodegenCode): VueCodegenCode {
	for (const piece of toArray(code)) {
		checkPiece(plugin, blocks, piece);
	}
	return code;
}

function checkPiece(plugin: string, blocks: Set<IRBlock>, piece: VueCodegenPiece) {
	if (typeof piece === 'string') {
		return;
	}
	const isPiece = typeof piece === 'object' && piece !== null && blocks.has(piece.source)
		&& isRange(piece.source, piece.start, piece.end) && typeof piece.data?.features === 'number'
		&& (piece.text === undefined || typeof piece.text === 'string');
	if (!isPiece) {
		throw new TypeError(
			`The codegen plugin '${plugin}' gave a piece that is not text or a range of a block of the file.`,
		);
	}
}

function isRange(block: IRBlock, start: unknown, end: unknown): boolean {
	return Number.isInteger(start) && Number.isInteger(end)
		&& 0 <= (start as number) && (start as number) <= (end as number) && (end as number) <= block.content.length;
}

function toArray<T>(value: readonly T[] | undefined): readonly T[] {
	return Array.isArray(value) ? value : [];
}
