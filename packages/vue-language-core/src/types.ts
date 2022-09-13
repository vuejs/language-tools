import * as embedded from '@volar/language-core';
import { SFCParseResult } from '@vue/compiler-sfc';

import * as CompilerDom from '@vue/compiler-dom';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { VueEmbeddedFile } from './sourceFile';

export type LanguageServiceHost = embedded.LanguageServiceHost & {
	getVueCompilationSettings(): VueCompilerOptions,
};

export type VueCompilerOptions = Partial<ResolvedVueCompilerOptions>;

export interface ResolvedVueCompilerOptions {
	target: 2 | 2.7 | 3;
	jsxTemplates: boolean;
	strictTemplates: boolean;
	plugins: string[];

	// experimental
	experimentalComponentOptionsWrapper: [string, string];
	experimentalComponentOptionsWrapperEnable: boolean | 'onlyJs';
	experimentalRuntimeMode: 'runtime-dom' | 'runtime-uni-app';
	experimentalDowngradePropsAndEmitsToSetupReturnOnScriptSetup: boolean | 'onlyJs';
	experimentalTemplateCompilerOptions: any;
	experimentalTemplateCompilerOptionsRequirePath: string | undefined;
	experimentalDisableTemplateSupport: boolean;
	experimentalResolveStyleCssClasses: 'scoped' | 'always' | 'never';
	experimentalAllowTypeNarrowingInInlineHandlers: boolean;
}

export type VueLanguagePlugin = (ctx: {
	modules: {
		typescript: typeof import('typescript/lib/tsserverlibrary');
	},
	compilerOptions: ts.CompilerOptions,
	vueCompilerOptions: ResolvedVueCompilerOptions,
}) => {
	order?: number;
	parseSFC?(fileName: string, content: string): SFCParseResult | undefined;
	updateSFC?(oldResult: SFCParseResult, textChange: { start: number, end: number, newText: string; }): SFCParseResult | undefined;
	compileSFCTemplate?(lang: string, template: string, options?: CompilerDom.CompilerOptions): CompilerDom.CodegenResult | undefined;
	updateSFCTemplate?(oldResult: CompilerDom.CodegenResult, textChange: { start: number, end: number, newText: string; }): CompilerDom.CodegenResult | undefined;
	getEmbeddedFileNames?(fileName: string, sfc: Sfc): string[];
	resolveEmbeddedFile?(fileName: string, sfc: Sfc, embeddedFile: VueEmbeddedFile): void;
};

export interface SfcBlock {
	tag: 'script' | 'scriptSetup' | 'template' | 'style' | 'customBlock',
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
	scriptSetup: SfcBlock | null;
	styles: (SfcBlock & {
		module: string | undefined;
		scoped: boolean;
	})[];
	customBlocks: (SfcBlock & {
		type: string;
	})[];

	// ast
	templateAst: CompilerDom.RootNode | undefined;
	scriptAst: ts.SourceFile | undefined;
	scriptSetupAst: ts.SourceFile | undefined;
}
