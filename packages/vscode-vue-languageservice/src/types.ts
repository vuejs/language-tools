import { BasicRuntimeContext, SourceFile, TypeScriptFeaturesRuntimeContext, LanguageServiceHostBase as LanguageServiceHostBase, EmbeddedDocumentSourceMap } from '@volar/vue-typescript';
import type * as css from 'vscode-css-languageservice';
import type { TextDocument } from 'vscode-css-languageservice';
import type * as json from 'vscode-json-languageservice';
import { LanguageServicePlugin } from './languageService';
// import { EmbeddedLanguagePlugin } from './plugins/definePlugin';

export type LanguageServiceHost = LanguageServiceHostBase & {
	schemaRequestService?: json.SchemaRequestService,
	getCssLanguageSettings?(document: TextDocument): Promise<css.LanguageSettings>,
};

export type DocumentServiceRuntimeContext = BasicRuntimeContext & {
	getVueDocument(document: TextDocument): SourceFile | undefined;
	// getPlugins(): EmbeddedLanguagePlugin[],
}

export type LanguageServiceRuntimeContext = BasicRuntimeContext & TypeScriptFeaturesRuntimeContext & {
	vueHost: LanguageServiceHost,
	getTextDocument(uri: string): TextDocument | undefined,
	getPlugins(lsType: 'template' | 'script' | undefined): LanguageServicePlugin[],
	getPluginById(id: number): LanguageServicePlugin | undefined,
}

export type RuntimeContext = LanguageServiceRuntimeContext | DocumentServiceRuntimeContext;
