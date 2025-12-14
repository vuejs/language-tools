import type { CodeInformation } from '@volar/language-core';
import type * as CompilerDOM from '@vue/compiler-dom';
import type { SFCParseResult } from '@vue/compiler-sfc';
import type { Segment } from 'muggle-string';
import type * as ts from 'typescript';
import type { VueEmbeddedCode } from './virtualCode/embeddedCodes';

export type { SFCParseResult } from '@vue/compiler-sfc';

export { VueEmbeddedCode };

export type RawVueCompilerOptions = Partial<Omit<VueCompilerOptions, 'target' | 'globalTypesPath' | 'plugins'>> & {
	strictTemplates?: boolean;
	target?: 'auto' | 3 | 3.3 | 3.5 | 3.6 | 99 | number;
	globalTypesPath?: string;
	plugins?: string[];
};

export interface VueCodeInformation extends CodeInformation {
	__importCompletion?: boolean;
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

export const validVersions = [2, 2.1, 2.2] as const;

export interface VueLanguagePluginReturn {
	version: typeof validVersions[number];
	name?: string;
	order?: number;
	requiredCompilerOptions?: string[];
	getLanguageId?(fileName: string): string | undefined;
	isValidFile?(fileName: string, languageId: string): boolean;
	parseSFC?(fileName: string, content: string): SFCParseResult | undefined;
	parseSFC2?(fileName: string, languageId: string, content: string): SFCParseResult | undefined;
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
		| Pick<Sfc['styles'][number], 'imports' | 'bindings' | 'classNames'>
		| undefined;
	updateSFCTemplate?(
		oldResult: CompilerDOM.CodegenResult,
		textChange: { start: number; end: number; newText: string },
	): CompilerDOM.CodegenResult | undefined;
	getEmbeddedCodes?(fileName: string, sfc: Sfc): { id: string; lang: string }[];
	resolveEmbeddedCode?(fileName: string, sfc: Sfc, embeddedFile: VueEmbeddedCode): void;
}

export type VueLanguagePlugin = (ctx: {
	modules: {
		typescript: typeof ts;
		'@vue/compiler-dom': typeof CompilerDOM;
	};
	compilerOptions: ts.CompilerOptions;
	vueCompilerOptions: VueCompilerOptions;
}) => VueLanguagePluginReturn | VueLanguagePluginReturn[];

export interface SfcBlock {
	name: string;
	start: number;
	end: number;
	startTagEnd: number;
	endTagStart: number;
	lang: string;
	content: string;
	attrs: Record<string, string | true>;
}

export type SfcBlockAttr = true | {
	text: string;
	offset: number;
	quotes: boolean;
};

export interface Sfc {
	content: string;
	comments: string[];
	template:
		| SfcBlock & {
			ast: CompilerDOM.RootNode | undefined;
			errors: CompilerDOM.CompilerError[];
			warnings: CompilerDOM.CompilerError[];
		}
		| undefined;
	script:
		| (SfcBlock & {
			src: SfcBlockAttr | undefined;
			ast: ts.SourceFile;
		})
		| undefined;
	scriptSetup:
		| SfcBlock & {
			// https://github.com/vuejs/rfcs/discussions/436
			generic: SfcBlockAttr | undefined;
			ast: ts.SourceFile;
		}
		| undefined;
	styles: readonly (SfcBlock & {
		src: SfcBlockAttr | undefined;
		module: SfcBlockAttr | undefined;
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
	})[];
	customBlocks: readonly (SfcBlock & {
		type: string;
	})[];
}

declare module '@vue/compiler-sfc' {
	interface SFCBlock {
		__src?: SfcBlockAttr;
	}

	interface SFCScriptBlock {
		__generic?: SfcBlockAttr;
	}

	interface SFCStyleBlock {
		__module?: SfcBlockAttr;
	}
}

export interface TextRange {
	start: number;
	end: number;
}
