import type * as ts from 'typescript/lib/tsserverlibrary';

export type LanguageServiceHost = ts.LanguageServiceHost & {
	loadTypeScriptModule(): typeof import('typescript/lib/tsserverlibrary');
	getVueCompilationSettings(): VueCompilerOptions,
	isTsPlugin?: boolean,
	isTsc?: boolean,
};

export interface VueCompilerOptions {
	target?: 2 | 2.7 | 3;
	strictTemplates?: boolean;

	// experimental
	experimentalRuntimeMode?: 'runtime-dom' | 'runtime-uni-app';
	experimentalImplicitWrapComponentOptionsWithDefineComponent?: boolean | 'onlyJs';
	experimentalImplicitWrapComponentOptionsWithVue2Extend?: boolean | 'onlyJs';
	experimentalDowngradePropsAndEmitsToSetupReturnOnScriptSetup?: boolean | 'onlyJs';
	experimentalTemplateCompilerOptions?: any;
	experimentalTemplateCompilerOptionsRequirePath?: string;
	experimentalDisableTemplateSupport?: boolean;
	experimentalResolveStyleCssClasses?: 'scoped' | 'always' | 'never';
	experimentalAllowTypeNarrowingInInlineHandlers?: boolean;
	experimentalUseScriptLeadingCommentInTemplate?: boolean;
}
