import * as shared from '@volar/shared';
import * as vue from '@volar/vue-language-service';
import type { FileSystemProvider } from 'vscode-html-languageservice';

export interface RuntimeEnvironment {
	loadTypescript: (initOptions: shared.ServerInitializationOptions) => typeof import('typescript/lib/tsserverlibrary'),
	loadTypescriptLocalized: (initOptions: shared.ServerInitializationOptions) => any,
	schemaRequestHandlers: { [schema: string]: (uri: string, encoding?: BufferEncoding) => Promise<string>; },
	onDidChangeConfiguration?: (settings: any) => void,
	fileSystemProvide: FileSystemProvider | undefined,
}

export interface LanguageConfigs {
	definitelyExts: string[],
	indeterminateExts: string[],
	getDocumentService: typeof vue.getDocumentService,
	createLanguageService: typeof vue.createLanguageService,
}
