import type * as ts from 'typescript/lib/tsserverlibrary';

export type LanguageServiceHost = ts.LanguageServiceHost & {
	getVueCompilationSettings?(): VueCompilerOptions,
	getVueProjectVersion?(): string;
};

export interface ITemplateScriptData {
	projectVersion: string | undefined;
	components: string[];
	componentItems: ts.CompletionEntry[];
}

export interface VueCompilerOptions {
	experimentalCompatMode?: 2 | 3;
	experimentalShamefullySupportOptionsApi?: boolean;
	experimentalTemplateCompilerOptions?: any;
	experimentalTemplateCompilerOptionsRequirePath?: string;
	experimentalDisableTemplateSupport?: boolean;
	experimentalResolveStyleCssClasses?: 'scoped' | 'always' | 'never';
}
