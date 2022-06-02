import type * as ts from 'typescript/lib/tsserverlibrary';

export type LanguageServiceHost = ts.LanguageServiceHost & {
	getVueCompilationSettings(): VueCompilerOptions,
};

export interface ITemplateScriptData {
	projectVersion: string | undefined;
	components: string[];
	componentItems: ts.CompletionEntry[];
}

export interface VueCompilerOptions {
	experimentalCompatMode?: 2 | 2.7 | 3;
	experimentalRuntimeMode?: 'runtime-dom' | 'runtime-uni-app';
	experimentalImplicitWrapComponentOptionsWithDefineComponent?: boolean | 'onlyJs';
	experimentalDowngradePropsAndEmitsToSetupReturnOnScriptSetup?: boolean | 'onlyJs';
	experimentalTemplateCompilerOptions?: any;
	experimentalTemplateCompilerOptionsRequirePath?: string;
	experimentalDisableTemplateSupport?: boolean;
	experimentalResolveStyleCssClasses?: 'scoped' | 'always' | 'never';
	experimentalAllowTypeNarrowingInInlineHandlers?: boolean;
	experimentalUseScriptLeadingCommentInTemplate?: boolean;
}
