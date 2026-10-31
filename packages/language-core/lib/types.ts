import type { SpanMapKind } from '@volar/language-core';
import type * as CompilerDOM from '@vue/compiler-dom';
import { type Piece, rewritePieceText } from 'muggle-string';
import type * as ts from 'typescript/ast' with { 'resolution-mode': 'import' };

/** The node types of the TypeScript 7 AST API, for packages that do not resolve `typescript` to it. */
export type { ts };

/**
 * The TypeScript 7 AST API with a synchronous parser.
 */
export type TypeScript = typeof import('typescript/ast', { with: { 'resolution-mode': 'import' }}) & {
	createSourceFile(
		fileName: string,
		sourceText: string,
		languageVersion: ts.ScriptTarget,
		setParentNodes?: boolean,
		scriptKind?: ts.ScriptKind,
	): ts.SourceFile;
};

export type RawVueCompilerOptions =
	& Partial<
		Omit<VueCompilerOptions, 'target' | 'plugins' | 'isDataAttribute' | 'isHtmlAttribute'>
	>
	& {
		target?: 'auto' | 3.3 | 3.5 | 3.6 | 99 | number;
		plugins?: RawPlugin[];
	};

export type RawPlugin =
	| string
	| Record<string, any> & {
		name: string;
	};

/** A `plugins` entry of the Vue compiler options, resolved to the module that its `name` names. */
export interface ResolvedVuePlugin {
	/** The `name` of the entry, as written. */
	name: string;
	/** The file that `name` resolves to. */
	file: string;
	/** The `package.json` of the package that `name` names, if `name` is a bare specifier. */
	packageJson?: { file: string; name: string; version: string | undefined };
	/** The entry without its `name`. */
	config: Record<string, any>;
	/** The exports of `file`. */
	module: unknown;
}

/** The `kind` and `features` of the `SpanMapSegment` a generated segment maps by. */
export interface VueCodeMarker {
	/** `SpanMapFeature` bits. */
	features: number;
	/** `SpanMapKind.Verbatim` if omitted. */
	kind?: SpanMapKind;
}

/** The IR of the file, at offsets of the file, or one of its blocks, at offsets of the block's content. */
export type CodeSource = IR | IRBlock;

/**
 * A piece of code: new text, which maps nowhere, or the range `start`..`end` of `source`, which maps by its `data`. A
 * range without `text` is a copy of the content of `source` there. `text` maps to the range char by char when it is as
 * long as the range, and as a whole otherwise.
 */
export type CodePiece<Data> = Piece<{ source: CodeSource; data: Data }>;

/** The text of `codes`. */
export function codeToString(codes: readonly CodePiece<unknown>[]): string {
	let text = '';
	for (const code of codes) {
		text += rewritePieceText(code);
	}
	return text;
}

/** A piece of an embedded document, which maps by its own marker alone. */
export type Code = CodePiece<VueCodeMarker>;

export interface VueCompilerOptions {
	target: number;
	lib: string;
	typesRoot: string;
	/**
	 * Selects the format of every file the plugin receives: a built-in one ('sfc' for a Vue SFC, 'vitepress' for
	 * VitePress markdown, 'petite-vue' for a petite-vue HTML page) or one of the `formats` of a plugin. A host sets it
	 * per `contentMappers` entry, through the entry's `format` option.
	 */
	format: string;
	/** Exposes `globalThis` in the template context, as petite-vue templates read globals directly. */
	globalTemplateContext: boolean;
	jsxSlots: boolean;
	strictCssModules: boolean;
	inferComponentDollarEl: boolean;
	inferComponentDollarRefs: boolean;
	inferTemplateDollarAttrs: boolean;
	inferTemplateDollarEl: boolean;
	inferTemplateDollarRefs: boolean;
	inferTemplateDollarSlots: boolean;
	vapor: boolean;
	fallthroughAttributes: boolean;
	checkRequiredFallthroughAttributes: boolean;
	resolveStyleClassNames: boolean | 'scoped';
	fallthroughComponentNames: string[];
	dataAttributes: string[];
	htmlAttributes: string[];
	isDataAttribute: (name: string) => boolean;
	isHtmlAttribute: (name: string) => boolean;
	optionsWrapper: [string, string] | [];
	macros: {
		defineProps: string[];
		defineSlots: string[];
		defineEmits: string[];
		defineExpose: string[];
		defineModel: string[];
		defineOptions: string[];
		withDefaults: string[];
	};
	composables: {
		useAttrs: string[];
		useCssModule: string[];
		useSlots: string[];
		useTemplateRef: string[];
	};
	plugins: ResolvedVuePlugin[];
	/**
	 * Prop that an argument-less `v-model` binds, keyed by tag, or `false` to bind none. Entries override
	 * the built-in rules of native elements, which follow `@vue/compiler-dom`; other tags bind `modelValue`.
	 */
	vModelPropName: Record<string, string | false>;
}

/** An edit of a text: the range `start`..`end` of the old text is replaced by `newText`. */
export interface TextChange {
	start: number;
	end: number;
	newText: string;
}

/** Reads a file into its blocks. */
export interface VueFormat {
	parse(fileName: string, content: string): VueFormatResult | undefined;
	/**
	 * The result for `change`, which keeps the objects of `old` for the blocks that `change` leaves as they are and
	 * does not modify `old`, or `undefined` to have the file parsed again.
	 */
	update?(old: VueFormatResult, change: TextChange): VueFormatResult | undefined;
}

/** The blocks of a file as its format reads them, at offsets of the file. */
export interface VueFormatResult {
	/** The top-level comments of the file. */
	comments: string[];
	/** Why the file is not read as written; the language service reports every one. */
	errors: CompilerDOM.CompilerError[];
	template: VueFormatBlock | undefined;
	script: VueFormatScript | undefined;
	scriptSetup: VueFormatScriptSetup | undefined;
	styles: VueFormatStyle[];
	customBlocks: VueFormatCustomBlock[];
	/** Whether the file is a Vapor component. */
	vapor?: boolean;
}

/** A block of a file: its `content`, at `offset` in the file. */
export interface VueFormatBlock {
	/** The text of the block, which a format may blank out in places that are not part of the block. */
	content: string;
	/** The offset of `content` in the file. */
	offset: number;
	lang: string;
	/**
	 * The range of the element that the block is written as, from its start tag to its end tag, if it is one, like
	 * the blocks of an SFC.
	 */
	element?: VueFormatElement;
}

export interface VueFormatElement {
	start: number;
	end: number;
}

export interface VueFormatScript extends VueFormatBlock {
	src?: IRAttr;
}

export interface VueFormatScriptSetup extends VueFormatBlock {
	generic?: IRAttr;
}

export interface VueFormatStyle extends VueFormatBlock {
	src?: IRAttr;
	module?: IRAttr;
	scoped?: boolean;
}

export interface VueFormatCustomBlock extends VueFormatBlock {
	type: string;
}

/** The AST of a template block. */
export interface TemplateCompileResult {
	ast: CompilerDOM.RootNode;
	/** Whether the compiler appended `>` to the template to close a tag that it ends in. */
	addedSuffix?: boolean;
}

/** Compiles the content of a template block of one language. */
export interface TemplateCompiler {
	compile(template: string, options: CompilerDOM.CompilerOptions): TemplateCompileResult | undefined;
	/** Updates `old` in place for `change`, or returns `undefined` to have the template compiled again. */
	update?(old: TemplateCompileResult, change: TextChange): TemplateCompileResult | undefined;
}

/** How the IR of a Vue file is built: its format, and the compiler of each block language. */
export interface IRPipeline {
	/** The SFC blocks of a file, and the format that read them. */
	parse(fileName: string, content: string): { result: VueFormatResult; format: VueFormat } | undefined;
	/** The AST of a template block, and the compiler that compiled it. */
	compileTemplate(
		lang: string,
		template: string,
		options: CompilerDOM.CompilerOptions,
	): { result: TemplateCompileResult; compiler: TemplateCompiler } | undefined;
	compileScript(lang: string, script: string): ts.SourceFile | undefined;
	compileStyle(lang: string, style: string): Pick<IRStyle, 'bindings' | 'classNames'>;
}

/**
 * The exports of a `plugins` entry's module. Each export is read by the consumers of its mode alone, so a
 * plugin takes part in a mode by exporting its key.
 */
export interface VuePluginModule {
	/** Changes how the IR is built, so every IR builder reads it: Content Mappers built on language-core, the language server and vue-component-meta. */
	ir?: VueIRPlugin | ((ctx: VuePluginContext) => VueIRPlugin);
	/** Contributions to the TS code that `@vue/content-mapper` generates, which defines and reads it alone (`VueCodegenPlugin`). */
	codegen?: unknown;
}

export interface VuePluginContext {
	/** The `plugins` entry without its `name`. */
	config: Record<string, any>;
	vueCompilerOptions: Readonly<VueCompilerOptions>;
}

/**
 * The HTML that a template language converts a template to, as pieces of the template. The host compiles their text,
 * and gives every location of the AST and of the compiler's errors and warnings the offsets of the template that the
 * ranges give, an offset into a range the offset of the template as far into it, up to its end:
 * - an offset of the HTML that several ranges cover gets the greatest of their template offsets;
 * - an offset that no range covers has no source and gets -1, which consumers skip rather than move to an offset nearby;
 * - a location of which only one end has a source has none: both of its ends get -1.
 */
export interface TemplateHTML {
	pieces: Piece[];
	/**
	 * Whether an error of the compiler, at offsets of `html`, the text of the pieces, comes from the conversion rather
	 * than the template, so that it is not reported.
	 */
	ignoreError?(error: CompilerDOM.CompilerError, html: string): boolean;
}

/**
 * Contributions to the IR. A format or template language belongs to the one plugin that provides its key; a key of
 * a built-in, or of an earlier plugin, fails to load.
 */
export interface VueIRPlugin {
	/** Formats that `vueCompilerOptions.format` selects by name, besides the built-in 'sfc', 'vitepress' and 'petite-vue'. */
	formats?: Record<string, VueFormat>;
	/** Converters of template languages to HTML, besides the built-in 'html' and 'md'. */
	templateCompilers?: Record<string, (source: string) => TemplateHTML | undefined>;
	/** Applied in `plugins` order to the options of every template compiler. */
	resolveTemplateCompilerOptions?(options: CompilerDOM.CompilerOptions): CompilerDOM.CompilerOptions;
	/** Calls to read as a macro of the key, e.g. `{ defineProps: ['$defineProps'] }`, added to `vueCompilerOptions.macros`. */
	macros?: Partial<VueCompilerOptions['macros']>;
}

/** Why a `plugins` entry, a part of it or the `format`, has no effect. */
export interface VuePluginError {
	/** The `name` of the entry, if the error is about one. */
	plugin?: string;
	message: string;
}

export interface IR {
	content: string;
	comments: string[];
	/** The `errors` of the format. */
	errors: readonly CompilerDOM.CompilerError[];
	template: IRTemplate | undefined;
	script: IRScript | undefined;
	scriptSetup: IRScriptSetup | undefined;
	styles: readonly IRStyle[];
	customBlocks: readonly IRCustomBlock[];
	/** The `vapor` of the format. */
	vapor: boolean;
}

/** An attribute without a value, or the value at its offset in the file. */
export type IRAttr = true | {
	text: string;
	offset: number;
};

export interface IRBlock extends Omit<VueFormatBlock, 'element'> {
	name: string;
	element: VueFormatElement | undefined;
}

export interface IRTemplate extends IRBlock {
	ast: CompilerDOM.RootNode | undefined;
	errors: CompilerDOM.CompilerError[];
	warnings: CompilerDOM.CompilerError[];
}

export interface IRScript extends IRBlock {
	src: IRAttr | undefined;
	ast: ts.SourceFile;
}

export interface IRScriptSetup extends IRBlock {
	generic: IRAttr | undefined;
	ast: ts.SourceFile;
}

export interface IRStyle extends IRBlock {
	src: IRAttr | undefined;
	module: IRAttr | undefined;
	scoped: boolean;
	bindings: {
		text: string;
		offset: number;
	}[];
	classNames: {
		text: string;
		offset: number;
	}[];
}

export interface IRCustomBlock extends IRBlock {
	type: string;
}

export interface TextRange<Node extends ts.Node = ts.Node> {
	node: Node;
	start: number;
	end: number;
}
