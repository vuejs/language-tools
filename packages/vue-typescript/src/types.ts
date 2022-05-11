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
	experimentalCompatMode?: 2 | 3;
	experimentalImplicitWrapComponentOptionsWithDefineComponent?: boolean;
	experimentalTemplateCompilerOptions?: any;
	experimentalTemplateCompilerOptionsRequirePath?: string;
	experimentalDisableTemplateSupport?: boolean;
	experimentalResolveStyleCssClasses?: 'scoped' | 'always' | 'never';
	experimentalAllowTypeNarrowingInInlineHandlers?: boolean;
}
