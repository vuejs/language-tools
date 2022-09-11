import { EmbeddedLanguageServicePlugin } from '@volar/language-service';
import { EmbeddedLanguageModule, LanguageServiceHost, EmbeddedLanguageContext, FileNode } from '@volar/language-core';
import type * as ts from 'typescript/lib/tsserverlibrary';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { SourceFileDocument, SourceFileDocuments } from './documents';

export interface DocumentServiceRuntimeContext {
	typescript: typeof import('typescript/lib/tsserverlibrary');
	plugins: EmbeddedLanguageServicePlugin[];
	getSourceFileDocument(document: TextDocument): [SourceFileDocument, EmbeddedLanguageModule] | undefined;
	updateSourceFile(sourceFile: FileNode, snapshot: ts.IScriptSnapshot): void;
	prepareLanguageServices(document: TextDocument): void;
};

export interface LanguageServiceRuntimeContext {
	host: LanguageServiceHost;
	core: EmbeddedLanguageContext;
	typescriptLanguageService: ts.LanguageService;
	documents: SourceFileDocuments;
	plugins: EmbeddedLanguageServicePlugin[];
	getTextDocument(uri: string): TextDocument | undefined;
};
