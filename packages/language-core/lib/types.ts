import type { CodeInformation } from '@volar/language-core';
import type * as CompilerDOM from '@vue/compiler-dom';
import type { Segment } from 'muggle-string';
import type * as ts from 'typescript';
import type { VueEmbeddedCode } from './virtualCode/embeddedCodes';
import type { RawIRAttr, RawIRParseResult } from './virtualCode/rawIr';

export type { SFCParseResult } from '@vue/compiler-sfc';

export { VueEmbeddedCode };

export type RawVueCompilerOptions = Partial<Omit<VueCompilerOptions, 'target' | 'plugins'>> & {
	strictTemplates?: boolean;
	target?: 'auto' | 3 | 3.3 | 3.5 | 3.6 | 99 | number;
	plugins?: RawPlugin[];
};

export type RawPlugin =
	| string
	| Record<string, any> & {
		name: string;
	};

export interface VueCodeInformation extends CodeInformation {
	__importCompletion?: boolean;
	__propsCompletion?: boolean;
	__shorthandExpression?: 'html' | 'js';
	__combineToken?: symbol;
	__linkedToken?: symbol;
}

export type Code = Segment<VueCodeInformation>;

export interface VueCompilerOptions {
	target: number;
	lib: string;
	typesRoot: string;
	extensions: string[];
	vitePressExtensions: string[];
	petiteVueExtensions: string[];
	jsxSlots: boolean;
	strictVModel: boolean;
	strictCssModules: boolean;
	checkUnknownProps: boolean;
	checkUnknownEvents: boolean;
	checkUnknownDirectives: boolean;
	checkUnknownComponents: boolean;
	inferComponentDollarEl: boolean;
	inferComponentDollarRefs: boolean;
	inferTemplateDollarAttrs: boolean;
	inferTemplateDollarEl: boolean;
	inferTemplateDollarRefs: boolean;
	inferTemplateDollarSlots: boolean;
	skipTemplateCodegen: boolean;
	fallthroughAttributes: boolean;
	checkRequiredFallthroughAttributes: boolean;
	resolveStyleImports: boolean;
	resolveStyleClassNames: boolean | 'scoped';
	fallthroughComponentNames: string[];
	dataAttributes: string[];
	htmlAttributes: string[];
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
	plugins: VueLanguagePlugin[];

	// experimental
	experimentalModelPropName: Record<
		string,
		Record<string, boolean | Record<string, string> | Record<string, string>[]>
	>;
}

export const validVersions = [3] as const;

export interface VueLanguagePluginReturn {
	version: typeof validVersions[number];
	name?: string;
	order?: number;
	requiredCompilerOptions?: string[];
	getLanguageId?(fileName: string): string | undefined;
	isValidFile?(fileName: string, languageId: string): boolean;
	parseSFC?(fileName: string, languageId: string, content: string): RawIRParseResult | undefined;
	updateSFC?(
		oldResult: RawIRParseResult,
		textChange: { start: number; end: number; newText: string },
	): RawIRParseResult | undefined;
	resolveTemplateCompilerOptions?(options: CompilerDOM.CompilerOptions): CompilerDOM.CompilerOptions;
	compileSFCScript?(lang: string, script: string): ts.SourceFile | undefined;
	compileSFCTemplate?(
		lang: string,
		template: string,
		options: CompilerDOM.CompilerOptions,
	): CompilerDOM.CodegenResult | undefined;
	compileSFCStyle?(lang: string, style: string):
		| Pick<IRStyle, 'imports' | 'bindings' | 'classNames'>
		| undefined;
	updateSFCTemplate?(
		oldResult: CompilerDOM.CodegenResult,
		textChange: { start: number; end: number; newText: string },
	): CompilerDOM.CodegenResult | undefined;
	getEmbeddedCodes?(fileName: string, ir: IR): { id: string; lang: string }[];
	resolveEmbeddedCode?(fileName: string, ir: IR, embeddedFile: VueEmbeddedCode): void;
}

export type VueLanguagePlugin<T extends Record<string, any> = {}> = (
	ctx: {
		modules: {
			typescript: typeof ts;
			'@vue/compiler-dom': typeof CompilerDOM;
			'@vue/language-core': typeof import('../index');
		};
		compilerOptions: ts.CompilerOptions;
		vueCompilerOptions: VueCompilerOptions;
		config: T;
	},
) => VueLanguagePluginReturn | VueLanguagePluginReturn[];

export interface IR {
	content: string;
	comments: string[];
	/** Alias for the first template block. */
	template: IRTemplate | undefined;
	script: IRScript | undefined;
	scriptSetup: IRScriptSetup | undefined;
	templates: readonly IRTemplate[];
	styles: readonly IRStyle[];
	customBlocks: readonly IRCustomBlock[];
}

export interface IRBlock {
	name: string;
	start: number;
	end: number;
	innerStart: number;
	innerEnd: number;
	lang: string;
	content: string;
	attrs: Record<string, RawIRAttr>;
}

export interface IRTemplate extends IRBlock {
	ast: CompilerDOM.RootNode | undefined;
	errors: CompilerDOM.CompilerError[];
	warnings: CompilerDOM.CompilerError[];
}

export interface IRScript extends IRBlock {
	src: RawIRAttr | undefined;
	ast: ts.SourceFile;
}

export interface IRScriptSetup extends IRBlock {
	generic: RawIRAttr | undefined;
	ast: ts.SourceFile;
}

export interface IRStyle extends IRBlock {
	src: RawIRAttr | undefined;
	module: RawIRAttr | undefined;
	scoped: boolean;
	imports: {
		text: string;
		offset: number;
	}[];
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
