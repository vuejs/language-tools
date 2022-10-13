import * as embedded from '@volar/language-core';
import { SFCParseResult } from '@vue/compiler-sfc';

import * as CompilerDom from '@vue/compiler-dom';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { VueEmbeddedFile } from './sourceFile';

export type { SFCParseResult } from '@vue/compiler-sfc';

export type LanguageServiceHost = embedded.LanguageServiceHost & {
	getVueCompilationSettings(): VueCompilerOptions,
};

export type VueCompilerOptions = Partial<ResolvedVueCompilerOptions>;

export interface ResolvedVueCompilerOptions {
	target: 2 | 2.7 | 3;
	jsxTemplates: boolean;
	strictTemplates: boolean;
	skipTemplateCodegen: boolean;
	dataAttributes: string[];
	htmlAttributes: string[];
	optionsWrapper: [string, string] | [];
	plugins: string[];
	narrowingTypesInInlineHandlers: boolean;
	bypassDefineComponentToExposePropsAndEmitsForJsScriptSetupComponents: boolean;

	// experimental
	experimentalRuntimeMode: 'runtime-dom' | 'runtime-uni-app';
	experimentalResolveStyleCssClasses: 'scoped' | 'always' | 'never';
	experimentalRfc436: boolean;
	experimentalModelPropName: Record<string, Record<string, boolean | Record<string, string> | Record<string, string>[]>>;
}

export type VueLanguagePlugin = (ctx: {
	modules: {
		typescript: typeof import('typescript/lib/tsserverlibrary');
		'@vue/compiler-dom': typeof import('@vue/compiler-dom');
	},
	compilerOptions: ts.CompilerOptions,
	vueCompilerOptions: ResolvedVueCompilerOptions,
}) => {
	name?: string;
	version: 1;
	order?: number;
	parseSFC?(fileName: string, content: string): SFCParseResult | undefined;
	updateSFC?(oldResult: SFCParseResult, textChange: { start: number, end: number, newText: string; }): SFCParseResult | undefined;
	resolveTemplateCompilerOptions?(options: CompilerDom.CompilerOptions): CompilerDom.CompilerOptions;
	compileSFCTemplate?(lang: string, template: string, options: CompilerDom.CompilerOptions): CompilerDom.CodegenResult | undefined;
	updateSFCTemplate?(oldResult: CompilerDom.CodegenResult, textChange: { start: number, end: number, newText: string; }): CompilerDom.CodegenResult | undefined;
	getEmbeddedFileNames?(fileName: string, sfc: Sfc): string[];
	resolveEmbeddedFile?(fileName: string, sfc: Sfc, embeddedFile: VueEmbeddedFile): void;
};

export interface SfcBlock {
	name: string,
	start: number;
	end: number;
	startTagEnd: number;
	endTagStart: number;
	lang: string;
	content: string;
}

export interface Sfc {
	template: SfcBlock | null;
	script: (SfcBlock & {
		src: string | undefined;
	}) | null;
	scriptSetup: SfcBlock & {
		// https://github.com/vuejs/rfcs/discussions/436
		generic: string | undefined;
		genericOffset: number;
	} | null;
	styles: (SfcBlock & {
		module: string | undefined;
		scoped: boolean;
	})[];
	customBlocks: (SfcBlock & {
		type: string;
	})[];

	// ast
	getTemplateAst: () => CompilerDom.RootNode | undefined;
	scriptAst: ts.SourceFile | undefined;
	scriptSetupAst: ts.SourceFile | undefined;
}
