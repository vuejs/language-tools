interface ContextStore {
	rootUri: string,
	configurationHost?: ConfigurationHost;
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

export interface ConfigurationHost {
	getConfiguration: (<T> (section: string, scopeUri?: string) => Promise<T | undefined>),
	onDidChangeConfiguration: (cb: () => void) => void,
}
