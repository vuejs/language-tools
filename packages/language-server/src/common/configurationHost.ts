import { ConfigurationHost } from '@volar/language-service';
import * as vscode from 'vscode-languageserver';

export function createConfigurationHost(params: vscode.InitializeParams, connection: vscode.Connection): ConfigurationHost & { ready(): void; } {

	const callbacks: (() => void)[] = [];
	const cache = new Map<string, any>();

	connection.onDidChangeConfiguration(async () => {
		cache.clear();
		for (const cb of callbacks) {
			cb();
		}
	});

	return {
		ready() {
			if (params.capabilities.workspace?.didChangeConfiguration?.dynamicRegistration) {
				connection.client.register(vscode.DidChangeConfigurationNotification.type);
			}
		},
		async getConfiguration(section, scopeUri) {
			if (!scopeUri && params.capabilities.workspace?.didChangeConfiguration) {
				if (!cache.has(section)) {
					cache.set(section, await getConfigurationWorker(section, scopeUri));
				}
				return cache.get(section);
			}
			return await getConfigurationWorker(section, scopeUri);
		},
		onDidChangeConfiguration(cb) {
			callbacks.push(cb);
		},
	};

	async function getConfigurationWorker(section: string, scopeUri?: string) {
		return (await connection.workspace.getConfiguration({ scopeUri, section })) ?? undefined /* replace null to undefined */;
	}
}
