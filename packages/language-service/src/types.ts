import { EmbeddedLanguageServicePlugin } from '@volar/language-service';
import { EmbeddedLanguageModule, LanguageServiceHost, EmbeddedLanguageContext, SourceFile } from '@volar/language-core';
import type * as ts from 'typescript/lib/tsserverlibrary';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { SourceFileDocument, SourceFileDocuments } from './documents';
import type { DocumentContext, FileSystemProvider } from 'vscode-html-languageservice';
import type { SchemaRequestService } from 'vscode-json-languageservice';
import { URI } from 'vscode-uri';

export interface DocumentServiceRuntimeContext {
	typescript: typeof import('typescript/lib/tsserverlibrary');
	plugins: EmbeddedLanguageServicePlugin[];
	pluginContext: LanguageServicePluginContext;
	getSourceFileDocument(document: TextDocument): [SourceFileDocument, EmbeddedLanguageModule] | undefined;
	updateSourceFile(sourceFile: SourceFile, snapshot: ts.IScriptSnapshot): void;
	prepareLanguageServices(document: TextDocument): void;
};

export interface LanguageServiceRuntimeContext {
	host: LanguageServiceHost;
	core: EmbeddedLanguageContext;
	typescriptLanguageService: ts.LanguageService;
	documents: SourceFileDocuments;
	plugins: EmbeddedLanguageServicePlugin[];
	pluginContext: LanguageServicePluginContext;
	getTextDocument(uri: string): TextDocument | undefined;
};

export interface LanguageServicePluginContext {
	typescript: {
		module: typeof import('typescript/lib/tsserverlibrary');
		languageServiceHost: ts.LanguageServiceHost;
		languageService: ts.LanguageService;
	},
	env: {
		rootUri: URI;
		configurationHost?: ConfigurationHost;
		documentContext?: DocumentContext;
		fileSystemProvider?: FileSystemProvider;
		schemaRequestService?: SchemaRequestService;
	},
}

export interface ConfigurationHost {
	getConfiguration: (<T> (section: string, scopeUri?: string) => Promise<T | undefined>),
	onDidChangeConfiguration: (cb: () => void) => void,
}
