import type { ElementNode } from '@vue/compiler-dom';
import {
	type IR,
	type IRBlock,
	type IRScript,
	type IRScriptSetup,
	type ScriptAnalysis,
	type TypeScript,
	type VueCompilerOptions,
	type VuePluginContext,
	type VuePluginError,
} from '@vue/language-core';
import { computed } from 'alien-signals';
import type { Piece, RewriteCode, RewriteCutOptions, RewriteSlice, RewriteWriter } from 'muggle-string';
import type { CodegenSlots, FilePlugin } from './filePlugin';
import type { BlockRewrite, BlockSlice, BlockWriter } from './rewrite/blockRewrite';
import type { ComponentExports } from './script';
import type { TsCodeData } from './tsCode';
import { identifierRE } from './writers';

/** The `codegen` export of a `plugins` entry's module. */
export type VueCodegenExport = VueCodegenPlugin | ((ctx: VuePluginContext) => VueCodegenPlugin);

/**
 * A codegen plugin. For each file, the `rewrite` of every plugin runs in `plugins` order, after those of the built-in
 * plugins, and so does the `generate` of every plugin. Both must be pure functions of `file` and the plugin context: no
 * file system, no environment, no cache shared across projects.
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
 * The types of what the code of the template declares for its nodes, as code of the template function: what a type at
 * the end of the template reads.
 */
export interface VueCodegenTemplate {
	/**
	 * The type of the instance of the component `node`, which the template declares for a component with a template ref
	 * or a root element whose `$el` is inferred; `undefined` for another node.
	 */
	instanceType(node: ElementNode): string | undefined;
	/** The type of the native element `tag`. */
	elementType(tag: string): string;
	/** The types of the props of the slot outlet `node`, and of its name when it is dynamic, without `defineSlots`. */
	slotOutletTypes(node: ElementNode): { props: string; name?: string } | undefined;
	/** The type of the attributes that fall through to the root of the template, `undefined` when none do. */
	fallthroughAttrsType(): string | undefined;
}

/**
 * A piece of code added by a contribution: plain text, which maps nowhere and never reports diagnostics, or the range
 * `start`..`end` of `source`, an IR block, mapped with `data.features`. A range without `text` copies the block's text
 * there; `text` maps to the range char by char when it is as long as the range, and as a whole otherwise (e.g. a
 * diagnostic reported there).
 */
export type VueCodegenPiece = Piece<{ source: IRBlock; data: VueCodegenData }>;

export interface VueCodegenData {
	features: number;
}

export type VueCodegenPieces = readonly VueCodegenPiece[];

/** A range that a writer cut from its block, with the edits in it; it renders where it is inserted, exactly once. */
export type VueCodegenSlice = RewriteSlice<IRBlock, VueCodegenData>;

/** Code that a writer inserts: pieces, slices, and arrays of them. */
export type VueCodegenCode = RewriteCode<IRBlock, VueCodegenData>;

/** The writers of the script blocks of the file, for one plugin. */
export interface VueCodegenWriters {
	script: VueCodegenWriter | undefined;
	scriptSetup: VueCodegenWriter | undefined;
}

/**
 * The writer of one script block, at offsets of its content. An edit out of the range of the block, a replacement of no
 * char, a cut without integer features, and code that is not text, a range of a block of the file or a slice throw.
 */
export type VueCodegenWriter = RewriteWriter<IRBlock, VueCodegenData>;

export interface VueCodegenSlots {
	/** Object types spread into the template context (what template expressions and `$` names resolve against). */
	templateContext?: readonly VueCodegenPieces[];
	/** `<script setup>` only: object types intersected into the public props, in `defineProps<…>` form. */
	props?: readonly VueCodegenPieces[];
	/** `<script setup>` only: object types `{ event: [args] }` intersected into the emits, in `defineEmits<…>` form. */
	emits?: readonly VueCodegenPieces[];
	/** `<script setup>` only: object types intersected into what the component exposes, in `defineExpose` form. */
	expose?: readonly VueCodegenPieces[];
	/** The tag → element type map of native elements, which replaces the DOM one in this file. */
	elements?: VueCodegenPieces;
	/** Statements at module scope, after the user's code. */
	declarations?: readonly VueCodegenPieces[];
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

/** The rewrites of the script blocks of a file. */
export interface ScriptRewrites {
	script: BlockRewrite | undefined;
	scriptSetup: BlockRewrite | undefined;
}

/**
 * Runs the `rewrite` of each plugin of the file, in order, with its writers of `rewrites`. An exception of a hook
 * propagates, and so does an edit that is not valid for the IR of the file.
 */
export function rewriteScripts(plugins: readonly FilePlugin[], ir: IR, rewrites: ScriptRewrites) {
	const file = createCodeCheck(ir);
	for (const [rank, { name, rewrite }] of plugins.entries()) {
		rewrite?.({
			script: rewrites.script && createWriter(name, file, rewrites.script.rewrite.writer(rank)),
			scriptSetup: rewrites.scriptSetup && createWriter(name, file, rewrites.scriptSetup.rewrite.writer(rank)),
		});
	}
}

/**
 * `plugin` for `file`. Its `generate` runs once, when a slot is first read; an exception of it propagates, and slots
 * that are not valid for the IR of the file throw.
 */
export function createFilePlugin({ name, plugin }: CodegenPlugin, file: VueCodegenFile): FilePlugin {
	const getSlots = computed(() => getSlotsOf(name, file.ir, plugin.generate?.(file)));
	return {
		name,
		rewrite: plugin.rewrite && (writers => plugin.rewrite!(file, writers)),
		templateContext: () => getSlots().templateContext,
		props: () => getSlots().props,
		emits: () => getSlots().emits,
		expose: () => getSlots().expose,
		elements: () => getSlots().elements,
		declarations: () => getSlots().declarations,
		exports: () => getSlots().exports,
	};
}

type PublicSlots = Pick<
	CodegenSlots,
	'templateContext' | 'props' | 'emits' | 'expose' | 'elements' | 'declarations' | 'exports'
>;

function getSlotsOf(plugin: string, ir: IR, contribution: VueCodegenSlots | undefined): PublicSlots {
	const blocks = getBlocks(ir);
	const slots: PublicSlots = {
		templateContext: [],
		props: [],
		emits: [],
		expose: [],
		elements: [],
		declarations: [],
		exports: [],
	};
	if (contribution === undefined) {
		return slots;
	}
	if (typeof contribution !== 'object' || contribution === null) {
		throw invalid(plugin, 'slots that are not an object');
	}
	const elements = toArray(plugin, 'elements', contribution.elements);
	if (elements.length) {
		slots.elements.push(checkPieces(plugin, blocks, elements));
	}
	for (const key of ['templateContext', 'props', 'emits', 'expose', 'declarations'] as const) {
		for (const type of toArray(plugin, key, contribution[key])) {
			slots[key].push(checkPieces(plugin, blocks, type));
		}
	}
	if (contribution.exports !== undefined) {
		slots.exports.push(getExportsOf(plugin, ir, contribution.exports));
	}
	return slots;
}

function getExportsOf(plugin: string, ir: IR, exports: NonNullable<VueCodegenSlots['exports']>): ComponentExports {
	if (typeof exports !== 'object' || exports === null) {
		throw invalid(plugin, 'exports that are not an object');
	}
	const names = toArray(plugin, 'exports.names', exports.names);
	for (const name of names) {
		if (typeof name !== 'string' || !identifierRE.test(name)) {
			throw invalid(plugin, `the export name ${JSON.stringify(name)}, which is not an identifier`);
		}
	}
	if (exports.default !== undefined && typeof exports.default !== 'boolean') {
		throw invalid(plugin, 'an `exports.default` that is not a boolean');
	}
	let docComment: string | undefined;
	if (exports.docComment !== undefined) {
		const { block, start, end } = exports.docComment ?? {};
		const text = (block === ir.script || block === ir.scriptSetup) && block && isRange(block, start, end)
			? block.content.slice(start, end)
			: undefined;
		// one block comment, so that it can't end the generated code's own comments or add code
		if (text === undefined || !/^\/\*(?:[^*]|\*(?!\/))*\*\/$/.test(text)) {
			throw invalid(plugin, 'a doc comment that is not one block comment of a script block');
		}
		docComment = text;
	}
	return { names, default: exports.default, docComment };
}

function invalid(plugin: string, what: string) {
	return new TypeError(`The codegen plugin '${plugin}' gave ${what}.`);
}

function getBlocks(ir: IR): Set<IRBlock> {
	return new Set([ir.template, ir.script, ir.scriptSetup, ...ir.styles, ...ir.customBlocks].filter(block => !!block));
}

/**
 * What the code of the plugins of a file can hold: ranges of its blocks, and the slices that their writers cut, which
 * a plugin holds as handles that render nothing, so that it can't freeze the rewrite before all plugins edit it.
 */
interface CodeCheck {
	blocks: Set<IRBlock>;
	slices: WeakMap<VueCodegenSlice, BlockSlice>;
}

function createCodeCheck(ir: IR): CodeCheck {
	return { blocks: getBlocks(ir), slices: new WeakMap() };
}

/** The writer of `plugin` that edits through `writer` the code that it checks. */
function createWriter(plugin: string, file: CodeCheck, writer: BlockWriter): VueCodegenWriter {
	return {
		insertBefore(offset, code) {
			writer.insertBefore(offset, checkCode(plugin, file, code));
		},
		insertAfter(offset, code) {
			writer.insertAfter(offset, checkCode(plugin, file, code));
		},
		replace(start, end, code) {
			writer.replace(start, end, checkCode(plugin, file, code));
		},
		cut(start, end, options) {
			const features = (options as Partial<RewriteCutOptions<IRBlock, VueCodegenData>> | undefined)?.data?.features;
			if (!Number.isInteger(features)) {
				throw new TypeError(`The codegen plugin '${plugin}' cut with features that are not an integer.`);
			}
			const { placeholder } = options;
			const slice = writer.cut(start, end, {
				data: { features: features! },
				placeholder: placeholder === undefined ? undefined : checkCode(plugin, file, placeholder),
			});
			const handle: VueCodegenSlice = {
				render() {
					throw new TypeError(`The codegen plugin '${plugin}' rendered a slice, which renders where it is inserted.`);
				},
			};
			file.slices.set(handle, slice);
			return handle;
		},
	};
}

/**
 * `code` with the slices that the writers of the file cut in place of their handles; throws if a part of it is not a
 * piece of `checkPieces` or such a handle.
 */
function checkCode(plugin: string, file: CodeCheck, code: VueCodegenCode): RewriteCode<IRBlock, TsCodeData> {
	if (Array.isArray(code)) {
		return (code as readonly VueCodegenCode[]).map(part => checkCode(plugin, file, part));
	}
	if (typeof code === 'object' && code !== null && 'render' in code) {
		const slice = file.slices.get(code);
		if (!slice) {
			throw invalid(plugin, 'a slice that no writer of the file cut');
		}
		return slice;
	}
	checkPiece(plugin, file.blocks, code as VueCodegenPiece);
	return code;
}

/** `pieces`, which throws if one is not text or a range of a block of the file mapped with features. */
function checkPieces(plugin: string, blocks: Set<IRBlock>, pieces: VueCodegenPieces): VueCodegenPieces {
	for (const piece of toArray(plugin, 'pieces', pieces)) {
		checkPiece(plugin, blocks, piece);
	}
	return pieces;
}

function checkPiece(plugin: string, blocks: Set<IRBlock>, piece: VueCodegenPiece) {
	if (typeof piece === 'string') {
		return;
	}
	const isPiece = typeof piece === 'object' && piece !== null && blocks.has(piece.source)
		&& isRange(piece.source, piece.start, piece.end) && typeof piece.data?.features === 'number'
		&& (piece.text === undefined || typeof piece.text === 'string');
	if (!isPiece) {
		throw invalid(plugin, 'a piece that is not text or a range of a block of the file');
	}
}

function isRange(block: IRBlock, start: unknown, end: unknown): boolean {
	return Number.isInteger(start) && Number.isInteger(end)
		&& 0 <= (start as number) && (start as number) <= (end as number) && (end as number) <= block.content.length;
}

/** `value`, an array, or none for `undefined`. */
function toArray<T>(plugin: string, key: string, value: readonly T[] | undefined): readonly T[] {
	if (value === undefined) {
		return [];
	}
	if (!Array.isArray(value)) {
		throw invalid(plugin, `a \`${key}\` that is not an array`);
	}
	return value;
}
