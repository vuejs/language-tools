import type { VueDocuments } from './vueDocuments';
import type * as ts from 'typescript/lib/tsserverlibrary';

export type LanguageServiceHostBase = ts.LanguageServiceHost & {
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
}

export type TypeScriptFeaturesRuntimeContext = {
	vueDocuments: VueDocuments;
	vueHost: LanguageServiceHostBase;
	scriptTsHost: ts.LanguageServiceHost;
	templateTsHost: ts.LanguageServiceHost | undefined;
	scriptTsLsRaw: ts.LanguageService;
	templateTsLsRaw: ts.LanguageService | undefined;
	getTsLs: <T extends 'template' | 'script'>(lsType: T) => T extends 'script' ? ts.LanguageService : (ts.LanguageService | undefined);
}
