import { LanguageServiceHost } from '@volar/vue-typescript';
import type { TextDocument } from 'vscode-css-languageservice';
import { LanguageServicePlugin } from './languageService';
import { EmbeddedLanguagePlugin } from '@volar/vue-language-service-types';
import type * as ts2 from '@volar/typescript-language-service';
import { VueDocument, VueDocuments } from './vueDocuments';

export { LanguageServiceHost } from '@volar/vue-typescript';

export type DocumentServiceRuntimeContext = {
	typescript: typeof import('typescript/lib/tsserverlibrary'),
	getVueDocument(document: TextDocument): VueDocument | undefined,
	getPlugins(): EmbeddedLanguagePlugin[],
	getFormatPlugins(): EmbeddedLanguagePlugin[],
	updateTsLs(document: TextDocument): void,
}

export type LanguageServiceRuntimeContext = {
	typescript: typeof import('typescript/lib/tsserverlibrary'),
	vueDocuments: VueDocuments,
	vueLsHost: LanguageServiceHost,
	getTextDocument(uri: string): TextDocument | undefined,
	getPlugins(lsType: 'template' | 'script' | 'nonTs'): LanguageServicePlugin[],
	getPluginById(id: number): LanguageServicePlugin | undefined,
	getTsLs: <T extends 'template' | 'script'>(lsType: T) => T extends 'script' ? ts2.LanguageService : (ts2.LanguageService | undefined);
}
