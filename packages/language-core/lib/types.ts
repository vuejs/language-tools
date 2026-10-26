import type { SpanMapKind } from '@volar/language-core';
import type * as CompilerDOM from '@vue/compiler-dom';
import type { SFCParseResult } from '@vue/compiler-sfc';
import type * as ts from 'typescript/ast' with { 'resolution-mode': 'import' };

export type { SFCParseResult } from '@vue/compiler-sfc';

/**
 * The TypeScript 7 AST API with a synchronous parser. Hosts on the classic TypeScript API pass it instead,
 * so language-core only reads what both APIs provide alike.
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
	/** The entry without its `name`. */
	config: Record<string, any>;
	/** The exports of `file`. */
	module: unknown;
}

/** The `kind` and `features` of the protocol `Mapping` a generated segment maps by, which the protocol has no object type for. */
export interface VueCodeMarker {
	/** `SpanMapFeature` bits. */
	features: number;
	/** `SpanMapKind.Verbatim` if omitted. */
	kind?: SpanMapKind;
}

/** A segment of code: plain text, or text that maps from an offset of a source by its `data`. */
export type CodeSegment<Data> =
	| string
	| [
		text: string,
		source: string | undefined,
		sourceOffset: number,
		data: Data,
	];

/** A segment of an embedded document, which maps by its own marker alone. */
export type Code = CodeSegment<VueCodeMarker>;

export interface VueCompilerOptions {
	target: number;
	lib: string;
	typesRoot: string;
	/**
	 * Selects the built-in parser of every file the plugin receives: a Vue SFC, VitePress markdown or a
	 * petite-vue HTML page. A host sets it per `contentMappers` entry, through the entry's `format` option.
	 */
	format: 'sfc' | 'vitepress' | 'petite-vue';
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

export const validVersions = [4] as const;

export interface VueLanguagePluginReturn {
	version: typeof validVersions[number];
	name?: string;
	order?: number;
	/**
	 * Parses a file into SFC blocks. The first plugin returning a result wins; otherwise the built-in
	 * parser of `vueCompilerOptions.format` is used. Which files reach it is decided by the host
	 * (the extensions of the `contentMappers` entry).
	 */
	parseSFC?(fileName: string, content: string): SFCParseResult | undefined;
	updateSFC?(
		oldResult: SFCParseResult,
		textChange: { start: number; end: number; newText: string },
	): SFCParseResult | undefined;
	resolveTemplateCompilerOptions?(options: CompilerDOM.CompilerOptions): CompilerDOM.CompilerOptions;
	compileSFCScript?(lang: string, script: string): ts.SourceFile | undefined;
	compileSFCTemplate?(
		lang: string,
		template: string,
		options: CompilerDOM.CompilerOptions,
	): CompilerDOM.CodegenResult | undefined;
	compileSFCStyle?(lang: string, style: string):
		| Pick<IRStyle, 'bindings' | 'classNames'>
		| undefined;
	updateSFCTemplate?(
		oldResult: CompilerDOM.CodegenResult,
		textChange: { start: number; end: number; newText: string },
	): CompilerDOM.CodegenResult | undefined;
}

export type VueLanguagePlugin<T extends Record<string, any> = {}> = (
	ctx: {
		modules: {
			typescript: TypeScript;
			'@vue/compiler-dom': typeof CompilerDOM;
			'@vue/language-core': typeof import('../index');
		};
		vueCompilerOptions: VueCompilerOptions;
		config: T;
	},
) => VueLanguagePluginReturn | VueLanguagePluginReturn[];

export interface IR {
	content: string;
	comments: string[];
	template: IRTemplate | undefined;
	script: IRScript | undefined;
	scriptSetup: IRScriptSetup | undefined;
	styles: readonly IRStyle[];
	customBlocks: readonly IRCustomBlock[];
}

export type IRAttr = true | {
	text: string;
	offset: number;
};

export interface IRBlock {
	name: string;
	start: number;
	end: number;
	startTagEnd: number;
	endTagStart: number;
	lang: string;
	content: string;
	attrs: Record<string, string | true>;
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

declare module '@vue/compiler-sfc' {
	interface SFCBlock {
		__src?: IRAttr;
	}

	interface SFCScriptBlock {
		__generic?: IRAttr;
	}

	interface SFCStyleBlock {
		__module?: IRAttr;
	}
}

export interface TextRange<Node extends ts.Node = ts.Node> {
	node: Node;
	start: number;
	end: number;
}
