import * as embeddedLS from '@volar/language-service';
import * as embedded from '@volar/language-core';
import type { FileSystemProvider } from 'vscode-html-languageservice';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as vscode from 'vscode-languageserver';
import type * as Requests from './requests';
import { URI } from 'vscode-uri';

export declare let __requests: typeof Requests; // keep this code for jsdoc link

export type FileSystemHost = {
	ready(connection: vscode.Connection): void,
	clearCache(): void,
	getWorkspaceFileSystem(rootUri: URI): FileSystem,
	onDidChangeWatchedFiles(cb: (params: vscode.DidChangeWatchedFilesParams, reason: 'lsp' | 'web-cache-updated') => void): () => void,
};

export type FileSystem = Pick<ts.System,
	'newLine'
	| 'useCaseSensitiveFileNames'
	| 'fileExists'
	| 'readFile'
	| 'readDirectory'
	| 'getCurrentDirectory'
	| 'realpath'
	| 'resolvePath'
> & Partial<ts.System>;

export interface RuntimeEnvironment {
	loadTypescript: (tsdk: string) => typeof import('typescript/lib/tsserverlibrary'),
	loadTypescriptLocalized: (tsdk: string, locale: string) => any,
	schemaRequestHandlers: { [schema: string]: (uri: string, encoding?: BufferEncoding) => Promise<string>; },
	onDidChangeConfiguration?: (settings: any) => void,
	fileSystemProvide: FileSystemProvider | undefined,
	createFileSystemHost: (
		ts: typeof import('typescript/lib/tsserverlibrary'),
		capabilities: vscode.ClientCapabilities,
	) => FileSystemHost,
}

export type LanguageServerPlugin<
	A extends InitializationOptions = InitializationOptions,
	B extends embedded.LanguageServiceHost = embedded.LanguageServiceHost,
	C = embeddedLS.LanguageService
> = (initOptions: A) => {

	extensions: string[],

	languageService?: {

		semanticTokenLegend?: vscode.SemanticTokensLegend,

		resolveLanguageServiceHost?(
			ts: typeof import('typescript/lib/tsserverlibrary'),
			sys: FileSystem,
			tsConfig: string | ts.CompilerOptions,
			host: embedded.LanguageServiceHost,
		): B,

		getLanguageModules?(host: B): embedded.EmbeddedLanguageModule[],

		getServicePlugins?(
			host: B,
			service: embeddedLS.LanguageService,
		): embeddedLS.LanguageServicePlugin[],

		onInitialize?(
			connection: vscode.Connection,
			getLangaugeService: (uri: string) => Promise<C>,
		): void,
	},

	documentService?: {

		getLanguageModules?(
			ts: typeof import('typescript/lib/tsserverlibrary'),
			env: embeddedLS.LanguageServicePluginContext['env'],
		): embedded.EmbeddedLanguageModule[],

		getServicePlugins?(
			context: embeddedLS.DocumentServiceRuntimeContext,
		): embeddedLS.LanguageServicePlugin[],
	};
};

export enum ServerMode {
	Semantic = 0,
	// PartialSemantic = 1, // not support yet
	Syntactic = 2
}

export enum DiagnosticModel {
	None = 0,
	Push = 1,
	Pull = 2,
}

export interface InitializationOptions {
	typescript: {
		// Absolute path to node_modules/typescript/lib
		tsdk: string;
	};
	serverMode?: ServerMode;
	diagnosticModel?: DiagnosticModel;
	textDocumentSync?: vscode.TextDocumentSyncKind | number;
	// for resolve https://github.com/sublimelsp/LSP-volar/issues/114
	ignoreTriggerCharacters?: string[],
}
