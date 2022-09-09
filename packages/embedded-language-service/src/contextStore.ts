import type { DocumentContext, FileSystemProvider } from 'vscode-html-languageservice';
import type { SchemaRequestService } from 'vscode-json-languageservice';
import type * as ts from 'typescript/lib/tsserverlibrary';

interface PluginContext {
	rootUri: string;
	typescript: {
		module: typeof import('typescript/lib/tsserverlibrary');
		languageServiceHost: ts.LanguageServiceHost;
		languageService: ts.LanguageService;
	},
	configurationHost?: ConfigurationHost;
	documentContext?: DocumentContext;
	fileSystemProvider?: FileSystemProvider;
	schemaRequestService?: SchemaRequestService;
}

export interface ConfigurationHost {
	getConfiguration: (<T> (section: string, scopeUri?: string) => Promise<T | undefined>),
	onDidChangeConfiguration: (cb: () => void) => void,
}

/**
 * TODO: remove these APIs
 */
export function setPluginContext(ctx: PluginContext) {
	(globalThis as any)['volar'] = ctx;
}

export function useRootUri() {
	return getContextStore().rootUri;
}

export function useConfigurationHost() {
	return getContextStore().configurationHost;
}

export function useDocumentContext() {
	return getContextStore().documentContext;
}

export function useFileSystemProvider() {
	return getContextStore().fileSystemProvider;
}

export function useSchemaRequestService() {
	return getContextStore().schemaRequestService;
}

export function useTypeScriptModule() {
	return getContextStore().typescript.module;
}

export function useTypeScriptLanguageService() {
	return getContextStore().typescript.languageService;
}

export function useTypeScriptLanguageServiceHost() {
	return getContextStore().typescript.languageServiceHost;
}

function getContextStore(): PluginContext {
	if (!('volar' in globalThis)) {
		throw `!('volar' in globalThis)`;
	}
	return (globalThis as any)['volar'];
}
