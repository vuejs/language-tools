import type * as ts2 from '@volar/typescript-language-service';
import { LanguageServiceHost } from '@volar/vue-language-core';
import { EmbeddedLanguageServicePlugin } from '@volar/embedded-language-service';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { VueDocument, VueDocuments } from './vueDocuments';

export interface DocumentServiceRuntimeContext {
	typescript: typeof import('typescript/lib/tsserverlibrary');
	getVueDocument(document: TextDocument): VueDocument | undefined;
	getPlugins(): EmbeddedLanguageServicePlugin[];
	updateTsLs(document: TextDocument): void;
};

export interface LanguageServiceRuntimeContext {
	host: LanguageServiceHost;
	vueDocuments: VueDocuments;
	getTextDocument(uri: string): TextDocument | undefined;
	getPlugins(): EmbeddedLanguageServicePlugin[];
	getPluginId(plugin: EmbeddedLanguageServicePlugin): number;
	getPluginById(id: number): EmbeddedLanguageServicePlugin | undefined;
	getTsLs(): ts2.LanguageService;
};
