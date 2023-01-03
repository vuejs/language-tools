import * as embeddedLS from '@volar/language-service';
import * as embedded from '@volar/language-core';
import type { FileSystemProvider } from 'vscode-html-languageservice';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as vscode from 'vscode-languageserver';
import { URI } from 'vscode-uri';

export type FileSystemHost = {
	ready(connection: vscode.Connection): void,
	reload(): void,
	getWorkspaceFileSystem(rootUri: URI): FileSystem,
	onDidChangeWatchedFiles(cb: (params: vscode.DidChangeWatchedFilesParams) => void): () => void,
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
	loadTypescriptLocalized: (tsdk: string, locale: string) => Promise<{} | undefined>,
	schemaRequestHandlers: { [schema: string]: (uri: string, encoding?: BufferEncoding) => Promise<string>; },
	onDidChangeConfiguration?: (settings: any) => void,
	fileSystemProvide: FileSystemProvider | undefined,
	createFileSystemHost: (
		ts: typeof import('typescript/lib/tsserverlibrary'),
		capabilities: vscode.ClientCapabilities,
	) => FileSystemHost,
}

export type LanguageServerPlugin<
	A extends LanguageServerInitializationOptions = LanguageServerInitializationOptions,
	B extends embedded.LanguageServiceHost = embedded.LanguageServiceHost,
	C = embeddedLS.LanguageService
> = (initOptions: A) => {

	extraFileExtensions?: ts.FileExtensionInfo[];

	resolveLanguageServiceHost?(
		ts: typeof import('typescript/lib/tsserverlibrary'),
		sys: FileSystem,
		tsConfig: string | ts.CompilerOptions,
		host: embedded.LanguageServiceHost,
	): B;

	getLanguageModules?(host: B): embedded.LanguageModule[];

	getServicePlugins?(
		host: B,
		service: embeddedLS.LanguageService,
	): embeddedLS.LanguageServicePlugin[];

	onInitialize?(
		connection: vscode.Connection,
		getLanguageService: (uri: string) => Promise<C>,
	): void;
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

export interface LanguageServerInitializationOptions {
	typescript: {
		// Absolute path to node_modules/typescript/lib
		tsdk: string;
	};
	serverMode?: ServerMode;
	diagnosticModel?: DiagnosticModel;
	textDocumentSync?: vscode.TextDocumentSyncKind | number;
	// for resolve https://github.com/sublimelsp/LSP-volar/issues/114
	ignoreTriggerCharacters?: string[];
	/**
	 * https://github.com/Microsoft/TypeScript/wiki/Standalone-Server-%28tsserver%29#cancellation
	 */
	cancellationPipeName?: string;
	noProjectReferences?: boolean;
	reverseConfigFilePriority?: boolean;
	disableFileWatcher?: boolean;
	/**
	 * Enable this option to make language server setup server capabilities based on client capabilities to support multiple servers.
	 */
	respectClientCapabilities?: boolean;
	maxFileSize?: number;
	configFilePath?: string;
	/**
	 * Extra semantic token types and modifiers that are supported by the client.
	 */
	semanticTokensLegend?: vscode.SemanticTokensLegend;
}
