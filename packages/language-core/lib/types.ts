import type * as CompilerDOM from '@vue/compiler-dom';
import type { SFCParseResult } from '@vue/compiler-sfc';
import type * as ts from 'typescript';
import type { VueEmbeddedCode } from './virtualFile/embeddedFile';
import type { CodeInformation, Segment } from '@volar/language-core';

export type { SFCParseResult } from '@vue/compiler-sfc';

export { VueEmbeddedCode };

export type RawVueCompilerOptions = Partial<Omit<VueCompilerOptions, 'target' | 'plugins'>> & {
	target?: 'auto' | 2 | 2.7 | 3 | 3.3;
	plugins?: string[];
};

export interface VueCodeInformation extends CodeInformation {
	__referencesCodeLens?: boolean;
	__displayWithLink?: boolean;
	__hint?: {
		setting: string;
		label: string;
		tooltip: string;
		paddingRight?: boolean;
		paddingLeft?: boolean;
	};
	__combineLastMapping?: boolean;
	__combineOffsetMapping?: number;
}

export type Code = Segment<VueCodeInformation>;

export interface VueCompilerOptions {
	target: number;
	lib: string;
	extensions: string[];
	vitePressExtensions: string[];
	petiteVueExtensions: string[];
	jsxSlots: boolean;
	strictTemplates: boolean;
	skipTemplateCodegen: boolean;
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
	plugins: VueLanguagePlugin[];

	// experimental
	experimentalDefinePropProposal: 'kevinEdition' | 'johnsonEdition' | false;
	experimentalResolveStyleCssClasses: 'scoped' | 'always' | 'never';
	experimentalModelPropName: Record<string, Record<string, boolean | Record<string, string> | Record<string, string>[]>>;
}

export const pluginVersion = 2;

export type VueLanguagePlugin = (ctx: {
	modules: {
		typescript: typeof import('typescript');
		'@vue/compiler-dom': typeof import('@vue/compiler-dom');
	};
	compilerOptions: ts.CompilerOptions;
	vueCompilerOptions: VueCompilerOptions;
	globalTypesHolder: string | undefined;
}) => {
	version: typeof pluginVersion;
	name?: string;
	order?: number;
	requiredCompilerOptions?: string[];
	parseSFC?(fileName: string, content: string): SFCParseResult | undefined;
	updateSFC?(oldResult: SFCParseResult, textChange: { start: number, end: number, newText: string; }): SFCParseResult | undefined;
	resolveTemplateCompilerOptions?(options: CompilerDOM.CompilerOptions): CompilerDOM.CompilerOptions;
	compileSFCTemplate?(lang: string, template: string, options: CompilerDOM.CompilerOptions): CompilerDOM.CodegenResult | undefined;
	updateSFCTemplate?(oldResult: CompilerDOM.CodegenResult, textChange: { start: number, end: number, newText: string; }): CompilerDOM.CodegenResult | undefined;
	getEmbeddedCodes?(fileName: string, sfc: Sfc): { id: string; lang: string; }[];
	resolveEmbeddedCode?(fileName: string, sfc: Sfc, embeddedFile: VueEmbeddedCode): void;
};

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

export interface Sfc {
	template: SfcBlock & {
		ast: CompilerDOM.RootNode | undefined;
		errors: CompilerDOM.CompilerError[];
		warnings: CompilerDOM.CompilerError[];
	} | undefined;
	script: (SfcBlock & {
		src: string | undefined;
		srcOffset: number;
		ast: ts.SourceFile;
	}) | undefined;
	scriptSetup: SfcBlock & {
		// https://github.com/vuejs/rfcs/discussions/436
		generic: string | undefined;
		genericOffset: number;
		ast: ts.SourceFile;
	} | undefined;
	styles: readonly (SfcBlock & {
		module: string | undefined;
		scoped: boolean;
		cssVars: {
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

	/**
	 * @deprecated use `template.ast` instead
	 */
	templateAst: CompilerDOM.RootNode | undefined;
	/**
	 * @deprecated use `script.ast` instead
	 */
	scriptAst: ts.SourceFile | undefined;
	/**
	 * @deprecated use `scriptSetup.ast` instead
	 */
	scriptSetupAst: ts.SourceFile | undefined;
}

export interface TextRange {
	start: number;
	end: number;
}
