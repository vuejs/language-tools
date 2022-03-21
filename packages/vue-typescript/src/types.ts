import type * as ts from 'typescript/lib/tsserverlibrary';

export type LanguageServiceHost = ts.LanguageServiceHost & {
	getVueCompilationSettings?(): VueCompilerOptions,
	getVueProjectVersion?(): string;
};

export interface ITemplateScriptData {
	projectVersion: string | undefined;
	context: string[];
	contextItems: ts.CompletionEntry[];
	components: string[];
	componentItems: ts.CompletionEntry[];
	props: string[];
	setupReturns: string[];
}

export interface VueCompilerOptions {
	experimentalCompatMode?: 2 | 3;
	experimentalTemplateCompilerOptions?: any;
	experimentalTemplateCompilerOptionsRequirePath?: string;
	experimentalDisableTemplateSupport?: boolean;
	experimentalResolveNonScopedCssClasses?: boolean;
}
