import type * as ts from 'typescript/lib/tsserverlibrary';

export type LanguageServiceHost = ts.LanguageServiceHost & {
	getTypeScriptModule(): typeof import('typescript/lib/tsserverlibrary');
	getVueCompilationSettings(): VueCompilerOptions,
	isTsPlugin?: boolean,
	isTsc?: boolean,
};

export type VueCompilerOptions = Partial<_VueCompilerOptions>;

export interface _VueCompilerOptions {
	target: 2 | 2.7 | 3;
	strictTemplates: boolean;

	// experimental
	experimentalRuntimeMode: 'runtime-dom' | 'runtime-uni-app';
	experimentalImplicitWrapComponentOptionsWithDefineComponent: boolean | 'onlyJs';
	experimentalImplicitWrapComponentOptionsWithVue2Extend: boolean | 'onlyJs';
	experimentalDowngradePropsAndEmitsToSetupReturnOnScriptSetup: boolean | 'onlyJs';
	experimentalTemplateCompilerOptions: any;
	experimentalTemplateCompilerOptionsRequirePath: string | undefined;
	experimentalDisableTemplateSupport: boolean;
	experimentalResolveStyleCssClasses: 'scoped' | 'always' | 'never';
	experimentalAllowTypeNarrowingInInlineHandlers: boolean;
}

export interface EmbeddedFileMappingData {
	vueTag: 'template' | 'script' | 'scriptSetup' | 'scriptSrc' | 'style' | 'customBlock' | undefined,
	vueTagIndex?: number,
	normalizeNewName?: (newName: string) => string,
	applyNewName?: (oldName: string, newName: string) => string,
	capabilities: {
		basic?: boolean,
		references?: boolean,
		definitions?: boolean,
		diagnostic?: boolean,
		rename?: boolean | {
			in: boolean,
			out: boolean,
		},
		completion?: boolean,
		semanticTokens?: boolean,
		referencesCodeLens?: boolean,
		displayWithLink?: boolean,
	},
}

export interface TeleportSideData {
	transformNewName?: (newName: string) => string,
	capabilities: {
		references?: boolean,
		definitions?: boolean,
		rename?: boolean,
	},
}

export interface TeleportMappingData {
	isAdditionalReference?: boolean;
	toSource: TeleportSideData,
	toTarget: TeleportSideData,
}

export interface TextRange {
	start: number,
	end: number,
}
