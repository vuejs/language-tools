import type { ElementNode } from '@vue/compiler-dom';
import {
	forEachElementNode,
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
import type { Piece, RewriteCode, RewriteCutOptions, RewriteSlice, RewriteWriter } from 'muggle-string';
import type { BlockRewrite, BlockSlice, BlockWriter } from './rewrite/blockRewrite';
import type { ComponentExports } from './script';
import type { TsCode, TsCodeData } from './tsCode';
import { identifierRE } from './writers';

/**
 * A codegen plugin: the `codegen` export of a `plugins` entry's module. It runs for each snapshot of each file, with the
 * context of its entry, and gives the plugin of the file. It must be a pure function of `file` and `ctx`: no file
 * system, no environment, no cache shared across projects. An exception of it or of what it gives propagates.
 */
export type VueCodegenPlugin = (file: VueCodegenFile, ctx: VuePluginContext) => VueCodegenFilePlugin;

export interface VueCodegenFile {
	/** The TS 7.1 AST API that parsed the IR's script ASTs. */
	ts: TypeScript;
	fileName: string;
	ir: IR;
	/** Resolved options (with SFC comment options), script and script-setup ranges, template scope. */
	analysis: ScriptAnalysis;
	/**
	 * The name of an identifier that the plugin declares: `__VLS_<hint>`, or that with `$<n>` when the generated code or
	 * a plugin before took it; the same hint is the same name. Only while `codegen` runs, so that each snapshot of the
	 * file gives the plugins the same names.
	 */
	name(hint: string): string;
	template: VueCodegenTemplate;
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
	/**
	 * The types of the props of the slot outlet `node`, and of its name when it is dynamic, when no plugin declares the
	 * slots.
	 */
	slotOutletTypes(node: ElementNode): { props: string; name?: string } | undefined;
	/** The type of the attributes that fall through to the root of the template, `undefined` when none do. */
	fallthroughAttrsType(): string | undefined;
}

/**
 * What a codegen plugin gives for a file: the edits of `rewrite`, which runs after those of the plugins before it, and
 * its code in the slots of the generated code, which the code of each slot reads lazily, after `rewrite` and the code
 * of the plugins before it. Each hook runs at most once for a snapshot of the file. The built-in plugins come first.
 */
export interface VueCodegenFilePlugin<Code = VueCodegenPiece | VueCodegenSlice> {
	/** Edits the user's code of `<script>` and `<script setup>` through the writer of each block. */
	rewrite?(writers: VueCodegenWriters): void;
	/** Object types spread into the template context (what template expressions and `$` names resolve against). */
	templateContext?(): readonly VueCodegenSlotCode<Code>[];
	/** Statements in the template function, before the code of the template. */
	templateBody?(): readonly VueCodegenSlotCode<Code>[];
	/**
	 * Type aliases at the end of the template, in its scope, which the template function returns to setup and the
	 * export; each name is one that `file.name()` gave the plugin.
	 */
	templateTypes?(): readonly VueCodegenDeclaration<Code>[];
	/**
	 * Object types intersected into the `$` names that the template reads and types (`$slots`, `$attrs`, `$refs`,
	 * `$el`), at the end of the template, in its scope.
	 */
	templateDollars?(): readonly VueCodegenSlotCode<Code>[];
	/** Code after the props of an element of the template, before its children, by element. */
	elementEnd?(): ReadonlyMap<ElementNode, readonly VueCodegenSlotCode<Code>[]>;
	/**
	 * `<script setup>` only: object types intersected into the props, in `defineProps<…>` form, which the template reads
	 * too.
	 */
	props?(): readonly VueCodegenSlotCode<Code>[];
	/** `<script setup>` only: the emits of the component, each with its type, its emit function, or both. */
	emits?(): readonly VueCodegenEmits<Code>[];
	/** `<script setup>` only: object types intersected into what the component exposes, in `defineExpose` form. */
	expose?(): readonly VueCodegenSlotCode<Code>[];
	/**
	 * `<script setup>` only: type parameters of the component, after those of its `generic` attribute; with one, the
	 * component is generic.
	 */
	generic?(): readonly VueCodegenSlotCode<Code>[];
	/**
	 * An expression of the slots that the component declares, in the scope of setup, e.g. what `defineSlots` returns:
	 * each slot outlet of the template is checked against it, and gives no types to infer the slots from. One plugin
	 * of a file at most gives one.
	 */
	declaredSlots?(): string | undefined;
	/**
	 * `<script setup>` only: object types intersected into the slots of the component, in `defineSlots` form; without
	 * one, the component takes any slot, as in Vue. Text, as the mapper places them in several places.
	 */
	componentSlots?(): readonly string[];
	/**
	 * `<script setup>` only: object types intersected into what a generic component exposes, after the types of its
	 * `defineExpose`.
	 */
	exposedInstanceTypes?(): readonly VueCodegenSlotCode<Code>[];
	/** `<script setup>` only: options of a component that is not generic, after its props, e.g. `__typeEl: …`. */
	componentOptions?(): readonly VueCodegenSlotCode<Code>[];
	/**
	 * `<script setup>` only: object types of the props that the component takes besides those that it declares, e.g.
	 * the attributes that fall through to its root; the keys of its emit props are omitted from them. Text, as the
	 * mapper places them in several places.
	 */
	fallthroughProps?(): readonly string[];
	/** Tag → element type maps of native elements; the first of the plugins replaces the DOM one in this file. */
	elements?(): readonly VueCodegenSlotCode<Code>[];
	/** Statements at module scope, after the user's code. */
	declarations?(): readonly VueCodegenSlotCode<Code>[];
	exports?(): VueCodegenExports | undefined;
}

/**
 * The code of a slot: a piece or a slice that a writer of the plugin cut, or them in order. The mapper places the code
 * of a slot once, so a slice in it renders there, exactly once.
 */
export type VueCodegenSlotCode<Code = VueCodegenPiece | VueCodegenSlice> = Code | readonly Code[];

export interface VueCodegenDeclaration<Code = VueCodegenPiece | VueCodegenSlice> {
	name: string;
	code: VueCodegenSlotCode<Code>;
}

/**
 * Emits of a component. Those of the component are the intersection of the `type` of each, which its type checks
 * against from Vue 3.5 when each has one, and else the emit functions, which also type its `$emit` and its emit props.
 */
export interface VueCodegenEmits<Code = VueCodegenPiece | VueCodegenSlice> {
	/**
	 * An object type of the emits in `defineEmits<…>` form; without `emit`, in `{ event: [args] }` form, whose emit
	 * function the mapper gives. Text with `emit`.
	 */
	type?: VueCodegenSlotCode<Code>;
	/** The type of the emit function, e.g. `typeof emit`. Text, as the mapper places it in several places. */
	emit?: string;
}

export interface VueCodegenExports {
	/** Named exports of the component. */
	names?: readonly string[];
	/** `false` drops the synthetic default export. A user `export default` in `<script>` is user code and stays. */
	default?: boolean;
	/** A doc comment of the block, copied onto the component's export. */
	docComment?: { block: IRScript | IRScriptSetup; start: number; end: number };
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
 * char, a cut without integer features, and code that is not text, a range of a block of the file or a slice that the
 * writers of the plugin cut throw.
 */
export type VueCodegenWriter = RewriteWriter<IRBlock, VueCodegenData>;

/**
 * A codegen plugin, built-in or of a `plugins` entry, by the name in its errors. The code of a built-in plugin is the
 * code of the generated code, which spans ranges that the pieces of a plugin of an entry can't.
 */
export interface CodegenPlugin {
	name: string;
	/** The plugin of `file`, whose slots give the names in `names` that `file.name()` gave it. */
	create(file: VueCodegenFile, names: ReadonlySet<string>): VueCodegenFilePlugin<TsCode>;
}

/**
 * The codegen plugins of `vueCompilerOptions.plugins`, in order, each with the context of its entry and checked for the
 * blocks of each file. An export that is not a function gives an error and is not loaded.
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
		if (typeof codegen !== 'function') {
			errors.push({ plugin: name, message: 'The `codegen` export must be a function.' });
			continue;
		}
		const ctx: VuePluginContext = { config, vueCompilerOptions };
		plugins.push({
			name,
			create: (file, names) => checkFilePlugin(name, file.ir, names, (codegen as VueCodegenPlugin)(file, ctx)),
		});
	}
	return { plugins, errors };
}

/** The rewrites of the script blocks of a file. */
export interface ScriptRewrites {
	script: BlockRewrite | undefined;
	scriptSetup: BlockRewrite | undefined;
}

/**
 * A slice that a writer of a plugin cut: a handle that renders nothing, so that the plugin can't freeze a rewrite before
 * all plugins edit it, and that each rewrite of the script blocks replays as a slice of its own.
 */
export class PluginSlice implements VueCodegenSlice {
	constructor(
		readonly plugin: string,
		/** The data of the chars of the cut. */
		readonly data: VueCodegenData,
	) {}

	render(): never {
		throw new TypeError(`The codegen plugin '${this.plugin}' rendered a slice, which renders where it is placed.`);
	}
}

/** Whether `code` is a slice, which is a slice of a plugin when one of its writers cut it. */
export function isSlice(code: unknown): code is PluginSlice {
	return typeof code === 'object' && code !== null && 'render' in code;
}

/** The slices of a rewrite of the script blocks, by the handles that the plugins hold. */
export type PluginSlices = ReadonlyMap<PluginSlice, BlockSlice>;

type BlockWriters = { [K in keyof ScriptRewrites]: BlockWriter | undefined };

/**
 * What the `rewrite` of a plugin edits, which is the same for each rewrite of the script blocks of one snapshot of the
 * file: its edits in order, which each rewrite replays, and the handles of its cuts, which its slots may place.
 */
export interface PluginEdits {
	edits: readonly ((writers: BlockWriters, slices: Map<PluginSlice, BlockSlice>) => void)[];
	cuts: ReadonlySet<PluginSlice>;
}

/**
 * The edits of the `rewrite` of `plugin`, run with writers of the script blocks of `ir` that throw on an edit that is
 * not valid for its block. An exception of the hook propagates.
 */
export function recordEdits(
	plugin: string,
	ir: IR,
	rewrite: ((writers: VueCodegenWriters) => void) | undefined,
): PluginEdits {
	const edits: PluginEdits['edits'][number][] = [];
	const cuts = new Set<PluginSlice>();
	const file: CodeCheck = { plugin, blocks: getBlocks(ir), cuts };
	rewrite?.({
		script: ir.script && createWriter(file, ir.script, 'script', edits),
		scriptSetup: ir.scriptSetup && createWriter(file, ir.scriptSetup, 'scriptSetup', edits),
	});
	return { edits, cuts };
}

/**
 * Replays the edits of each plugin, in order, on its writers of `rewrites`, and gives the slices of its cuts there.
 */
export function rewriteScripts(
	plugins: readonly { getEdits(): PluginEdits }[],
	rewrites: ScriptRewrites,
): PluginSlices {
	const slices = new Map<PluginSlice, BlockSlice>();
	for (const [rank, { getEdits }] of plugins.entries()) {
		const writers: BlockWriters = {
			script: rewrites.script?.rewrite.writer(rank),
			scriptSetup: rewrites.scriptSetup?.rewrite.writer(rank),
		};
		for (const edit of getEdits().edits) {
			edit(writers, slices);
		}
	}
	return slices;
}

const codeSlots = [
	'templateContext',
	'templateBody',
	'templateDollars',
	'props',
	'expose',
	'generic',
	'exposedInstanceTypes',
	'componentOptions',
	'elements',
	'declarations',
] as const;

const textSlots = ['componentSlots', 'fallthroughProps'] as const;

/**
 * `filePlugin`, which `plugin` gave for a file of `ir`, whose slots throw when they give what is not valid for the
 * file, and whose names in `templateTypes` are of `names`.
 */
function checkFilePlugin(
	plugin: string,
	ir: IR,
	names: ReadonlySet<string>,
	filePlugin: unknown,
): VueCodegenFilePlugin<TsCode> {
	if (typeof filePlugin !== 'object' || filePlugin === null) {
		throw invalid(plugin, 'a plugin of the file that is not an object');
	}
	const blocks = getBlocks(ir);
	const checked: Record<string, unknown> = {};
	for (const [key, hook] of Object.entries(filePlugin)) {
		if (typeof hook !== 'function') {
			throw invalid(plugin, `a \`${key}\` that is not a function`);
		}
		const read = () => hook.call(filePlugin);
		if (key === 'rewrite') {
			checked[key] = hook.bind(filePlugin);
		}
		else if ((codeSlots as readonly string[]).includes(key)) {
			checked[key] = () => checkSlotCodes(plugin, blocks, key, read());
		}
		else if ((textSlots as readonly string[]).includes(key)) {
			checked[key] = () => {
				const texts = toArray(plugin, key, read());
				if (texts.some(text => typeof text !== 'string')) {
					throw invalid(plugin, `a \`${key}\` that is not text`);
				}
				return texts;
			};
		}
		else if (key === 'templateTypes') {
			checked[key] = () =>
				toArray<VueCodegenDeclaration>(plugin, key, read()).map(declaration => {
					if (typeof declaration !== 'object' || declaration === null || !names.has(declaration.name)) {
						throw invalid(plugin, 'a template type whose name `file.name()` did not give it');
					}
					return { name: declaration.name, code: checkSlotCode(plugin, blocks, declaration.code) };
				});
		}
		else if (key === 'elementEnd') {
			checked[key] = () => {
				const elementEnd = read();
				if (!(elementEnd instanceof Map)) {
					throw invalid(plugin, 'an `elementEnd` that is not a map');
				}
				const elements = new Set(ir.template?.ast ? forEachElementNode(ir.template.ast) : []);
				for (const [node, codes] of elementEnd) {
					if (!elements.has(node)) {
						throw invalid(plugin, 'an `elementEnd` of a node that is not an element of the template');
					}
					checkSlotCodes(plugin, blocks, key, codes);
				}
				return elementEnd;
			};
		}
		else if (key === 'emits') {
			checked[key] = () =>
				toArray<VueCodegenEmits>(plugin, key, read()).map(emits => {
					if (typeof emits !== 'object' || emits === null || (emits.type === undefined && emits.emit === undefined)) {
						throw invalid(plugin, 'emits that are not an object with a type or an emit function');
					}
					if (emits.emit !== undefined && (typeof emits.emit !== 'string' || typeof (emits.type ?? '') !== 'string')) {
						throw invalid(plugin, 'emits with an emit function whose type or itself is not text');
					}
					return {
						type: emits.type === undefined ? undefined : checkSlotCode(plugin, blocks, emits.type),
						emit: emits.emit,
					};
				});
		}
		else if (key === 'declaredSlots') {
			checked[key] = () => {
				const slots = read();
				if (slots !== undefined && typeof slots !== 'string') {
					throw invalid(plugin, 'a `declaredSlots` that is not text');
				}
				return slots;
			};
		}
		else if (key === 'exports') {
			checked[key] = read;
		}
		else {
			throw invalid(plugin, `\`${key}\`, which is not a slot`);
		}
	}
	return checked;
}

function checkSlotCodes(plugin: string, blocks: Set<IRBlock>, key: string, codes: unknown) {
	for (const code of toArray(plugin, key, codes as readonly VueCodegenSlotCode[])) {
		checkSlotCode(plugin, blocks, code);
	}
	return codes as readonly VueCodegenSlotCode[];
}

/** `code`, whose slices are checked where the slots of the plugins merge, with the cuts of its rewrite. */
function checkSlotCode(plugin: string, blocks: Set<IRBlock>, code: VueCodegenSlotCode) {
	for (const part of Array.isArray(code) ? code as readonly VueCodegenSlotCode[] : [code]) {
		if (!isSlice(part)) {
			checkPiece(plugin, blocks, part as VueCodegenPiece);
		}
	}
	return code;
}

/** The exports that `plugin` sets for the component of `ir`, which throw if they are not valid for it. */
export function getExportsOf(plugin: string, ir: IR, exports: VueCodegenExports): ComponentExports {
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

/** What the code of a plugin can hold: ranges of the blocks of its file, and the slices that its writers cut. */
interface CodeCheck {
	plugin: string;
	blocks: Set<IRBlock>;
	cuts: Set<PluginSlice>;
}

/** The writer of `block` for the plugin of `file`, which records its edits of the writer of `key` in `edits`. */
function createWriter(
	file: CodeCheck,
	block: IRBlock,
	key: keyof BlockWriters,
	edits: PluginEdits['edits'][number][],
): VueCodegenWriter {
	const { plugin } = file;
	const checkRange = (start: number, end: number) => {
		if (!isRange(block, start, end)) {
			throw new RangeError(`The codegen plugin '${plugin}' edited ${start}..${end}, out of its block.`);
		}
	};
	return {
		insertBefore(offset, code) {
			checkRange(offset, offset);
			const checked = checkCode(file, code);
			edits.push((writers, slices) => writers[key]!.insertBefore(offset, resolveSlices(checked, slices)));
		},
		insertAfter(offset, code) {
			checkRange(offset, offset);
			const checked = checkCode(file, code);
			edits.push((writers, slices) => writers[key]!.insertAfter(offset, resolveSlices(checked, slices)));
		},
		replace(start, end, code) {
			checkRange(start, end);
			if (start === end) {
				throw new RangeError(`The codegen plugin '${plugin}' replaced ${start}..${end}, which is no char.`);
			}
			const checked = checkCode(file, code);
			edits.push((writers, slices) => writers[key]!.replace(start, end, resolveSlices(checked, slices)));
		},
		cut(start, end, options) {
			checkRange(start, end);
			const features = (options as Partial<RewriteCutOptions<IRBlock, VueCodegenData>> | undefined)?.data?.features;
			if (!Number.isInteger(features)) {
				throw new TypeError(`The codegen plugin '${plugin}' cut with features that are not an integer.`);
			}
			const placeholder = options.placeholder === undefined ? undefined : checkCode(file, options.placeholder);
			const slice = new PluginSlice(plugin, { features: features! });
			file.cuts.add(slice);
			edits.push((writers, slices) =>
				slices.set(
					slice,
					writers[key]!.cut(start, end, {
						data: { features: features! },
						placeholder: placeholder === undefined ? undefined : resolveSlices(placeholder, slices),
					}),
				)
			);
			return slice;
		},
	};
}

/** `code`, which throws if a part of it is not a piece of `checkPiece` or a slice that the writers of `file` cut. */
function checkCode(file: CodeCheck, code: VueCodegenCode): VueCodegenCode {
	if (Array.isArray(code)) {
		for (const part of code as readonly VueCodegenCode[]) {
			checkCode(file, part);
		}
	}
	else if (isSlice(code)) {
		if (!file.cuts.has(code)) {
			throw invalid(file.plugin, 'a slice that its writers did not cut');
		}
	}
	else {
		checkPiece(file.plugin, file.blocks, code as VueCodegenPiece);
	}
	return code;
}

/** `code` with the slices of `slices` in place of their handles. */
function resolveSlices(code: VueCodegenCode, slices: PluginSlices): RewriteCode<IRBlock, TsCodeData> {
	if (Array.isArray(code)) {
		return (code as readonly VueCodegenCode[]).map(part => resolveSlices(part, slices));
	}
	if (isSlice(code)) {
		return slices.get(code)!;
	}
	return code as VueCodegenPiece;
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
