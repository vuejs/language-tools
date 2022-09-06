import type { DocumentContext, FileSystemProvider } from 'vscode-html-languageservice';
import type { SchemaRequestService } from 'vscode-json-languageservice';

interface ContextStore {
	rootUri: string;
	configurationHost?: ConfigurationHost;
	documentContext?: DocumentContext;
	fileSystemProvider?: FileSystemProvider;
	schemaRequestService?: SchemaRequestService;
}

export interface ConfigurationHost {
	getConfiguration: (<T> (section: string, scopeUri?: string) => Promise<T | undefined>),
	onDidChangeConfiguration: (cb: () => void) => void,
}

export function setContextStore(store: ContextStore) {
	(globalThis as any)['volar'] = store;
}

function getContextStore(): ContextStore {
	if (!('volar' in globalThis)) {
		throw `!('volar' in globalThis)`;
	}
	return (globalThis as any)['volar'];
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
