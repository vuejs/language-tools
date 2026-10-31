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
	/** The types of the props of the slot outlet `node`, and of its name when it is dynamic, without `defineSlots`. */
	slotOutletTypes(node: ElementNode): { props: string; name?: string } | undefined;
	/** The type of the attributes that fall through to the root of the template, `undefined` when none do. */
	fallthroughAttrsType(): string | undefined;
}

/**
 * What a codegen plugin gives for a file: the edits of `rewrite`, which runs after those of the plugins before it, and
 * its code in the slots of the generated code, which the code of each slot reads lazily, after the code of the plugins
 * before it. The built-in plugins come first.
 */
export interface VueCodegenFilePlugin<Code = VueCodegenPiece> {
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
	/** `<script setup>` only: object types intersected into the public props, in `defineProps<…>` form. */
	props?(): readonly VueCodegenSlotCode<Code>[];
	/** `<script setup>` only: object types `{ event: [args] }` intersected into the emits, in `defineEmits<…>` form. */
	emits?(): readonly VueCodegenSlotCode<Code>[];
	/** `<script setup>` only: object types intersected into what the component exposes, in `defineExpose` form. */
	expose?(): readonly VueCodegenSlotCode<Code>[];
	/** Object types intersected into what a generic component exposes, after the types of its `defineExpose`. */
	exposedInstanceTypes?(): readonly string[];
	/** Options of the component, after its props, e.g. `__typeEl: …`. */
	componentOptions?(): readonly string[];
	/**
	 * Object types of the props that the component takes besides those that it declares, e.g. the attributes that fall
	 * through to its root; the keys of its emit props are omitted from them.
	 */
	fallthroughProps?(): readonly string[];
	/** Tag → element type maps of native elements; the first of the plugins replaces the DOM one in this file. */
	elements?(): readonly VueCodegenSlotCode<Code>[];
	/** Statements at module scope, after the user's code. */
	declarations?(): readonly VueCodegenSlotCode<Code>[];
	exports?(): VueCodegenExports | undefined;
}

/** The code of a slot: a piece, or pieces in order. A slot holds no slice, which renders in the block it is cut from. */
export type VueCodegenSlotCode<Code = VueCodegenPiece> = Code | readonly Code[];

export interface VueCodegenDeclaration<Code = VueCodegenPiece> {
	name: string;
	code: VueCodegenSlotCode<Code>;
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
 * char, a cut without integer features, and code that is not text, a range of a block of the file or a slice throw.
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
 * Runs the `rewrite` of each plugin of the file, in order, with its writers of `rewrites`. An exception of a hook
 * propagates, and so does an edit that is not valid for the IR of the file.
 */
export function rewriteScripts(
	plugins: readonly { name: string; rewrite?(writers: VueCodegenWriters): void }[],
	ir: IR,
	rewrites: ScriptRewrites,
) {
	const file = createCodeCheck(ir);
	for (const [rank, { name, rewrite }] of plugins.entries()) {
		rewrite?.({
			script: rewrites.script && createWriter(name, file, rewrites.script.rewrite.writer(rank)),
			scriptSetup: rewrites.scriptSetup && createWriter(name, file, rewrites.scriptSetup.rewrite.writer(rank)),
		});
	}
}

const codeSlots = [
	'templateContext',
	'templateBody',
	'templateDollars',
	'props',
	'emits',
	'expose',
	'elements',
	'declarations',
] as const;

const textSlots = ['exposedInstanceTypes', 'componentOptions', 'fallthroughProps'] as const;

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

function checkSlotCode(plugin: string, blocks: Set<IRBlock>, code: VueCodegenSlotCode) {
	for (const piece of Array.isArray(code) ? code as readonly VueCodegenPiece[] : [code as VueCodegenPiece]) {
		checkPiece(plugin, blocks, piece);
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
