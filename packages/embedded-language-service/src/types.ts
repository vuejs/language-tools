import { EmbeddedLanguageServicePlugin } from '@volar/embedded-language-service';
import { EmbeddedLanguageModule, EmbeddedTypeScriptLanguageServiceHost, LanguageContext } from '@volar/embedded-language-core';
import type * as ts from 'typescript/lib/tsserverlibrary';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { SourceFileDocument, SourceFileDocuments } from './documents';

export interface DocumentServiceRuntimeContext {
	typescript: typeof import('typescript/lib/tsserverlibrary');
	plugins: EmbeddedLanguageServicePlugin[];
	getAndUpdateDocument(document: TextDocument): [SourceFileDocument, EmbeddedLanguageModule] | undefined;
	prepareLanguageServices(document: TextDocument): void;
};

export interface LanguageServiceRuntimeContext {
	host: EmbeddedTypeScriptLanguageServiceHost;
	core: LanguageContext;
	typescriptLanguageService: ts.LanguageService;
	documents: SourceFileDocuments;
	plugins: EmbeddedLanguageServicePlugin[];
	getTextDocument(uri: string): TextDocument | undefined;
};
