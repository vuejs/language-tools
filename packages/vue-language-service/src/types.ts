import { BasicRuntimeContext, VueDocument, LanguageServiceHostBase, TypeScriptRuntime } from '@volar/vue-typescript';
import type * as css from 'vscode-css-languageservice';
import type { TextDocument } from 'vscode-css-languageservice';
import type * as json from 'vscode-json-languageservice';
import { LanguageServicePlugin } from './languageService';
import { EmbeddedLanguagePlugin } from '@volar/vue-language-service-types';
import type * as ts2 from '@volar/typescript-language-service';

export type LanguageServiceHost = LanguageServiceHostBase & {
	schemaRequestService?: json.SchemaRequestService,
	getCssLanguageSettings?(document: TextDocument): Promise<css.LanguageSettings>,
};

export type DocumentServiceRuntimeContext = BasicRuntimeContext & {
	getVueDocument(document: TextDocument): VueDocument | undefined,
	getPlugins(): EmbeddedLanguagePlugin[],
	getFormatPlugins(): EmbeddedLanguagePlugin[],
	updateTsLs(document: TextDocument): void,
}

export type LanguageServiceRuntimeContext = BasicRuntimeContext & {
	tsRuntime: TypeScriptRuntime,
	vueHost: LanguageServiceHost,
	scriptTsLs: ts2.LanguageService;
	templateTsLs: ts2.LanguageService | undefined;
	getTextDocument(uri: string): TextDocument | undefined,
	getPlugins(lsType: 'template' | 'script' | 'nonTs'): LanguageServicePlugin[],
	getPluginById(id: number): LanguageServicePlugin | undefined,
	getTsLs: <T extends 'template' | 'script'>(lsType: T) => T extends 'script' ? ts2.LanguageService : (ts2.LanguageService | undefined);
}
