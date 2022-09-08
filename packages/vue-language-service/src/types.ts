import type * as ts2 from '@volar/typescript-language-service';
import { EmbeddedLanguageModule, VueLanguageServiceHost } from '@volar/vue-language-core';
import { EmbeddedLanguageServicePlugin } from '@volar/embedded-language-service';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { SourceFileDocument, SourceFileDocuments } from './vueDocuments';

export interface DocumentServiceRuntimeContext {
	typescript: typeof import('typescript/lib/tsserverlibrary');
	plugins: EmbeddedLanguageServicePlugin[];
	getAndUpdateVueDocument(document: TextDocument): [SourceFileDocument, EmbeddedLanguageModule] | undefined;
	updateTsLs(document: TextDocument): void;
};

export interface LanguageServiceRuntimeContext {
	host: VueLanguageServiceHost;
	vueDocuments: SourceFileDocuments;
	plugins: EmbeddedLanguageServicePlugin[];
	getTextDocument(uri: string): TextDocument | undefined;
	getTsLs(): ts2.LanguageService;
};
