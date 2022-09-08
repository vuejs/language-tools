import * as base from '@volar/embedded-typescript-language-core';

export type VueLanguageServiceHost = base.LanguageServiceHost & {
	getVueCompilationSettings(): VueCompilerOptions,
};

export type VueCompilerOptions = Partial<_VueCompilerOptions>;

export interface _VueCompilerOptions {
	target: 2 | 2.7 | 3;
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
