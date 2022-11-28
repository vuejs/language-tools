import * as vscode from 'vscode-languageserver';
import { ConfigurationHost } from '@volar/language-service';

export function createConfigurationHost(params: vscode.InitializeParams, connection: vscode.Connection): ConfigurationHost & { ready(): void; } {

	const callbacks: Function[] = [];
	let cache: Record<string, any> = {};

	connection.onDidChangeConfiguration(async () => {
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
				cache[section] ??= await getConfigurationWorker(section, scopeUri);
				return cache[section];
			}
			return await getConfigurationWorker(section, scopeUri);
		},
		onDidChangeConfiguration(cb) {
			cache = {};
			callbacks.push(cb);
		},
	};

	async function getConfigurationWorker(section: string, scopeUri?: string) {
		return (await connection.workspace.getConfiguration({ scopeUri, section })) ?? undefined /* replace null to undefined */;
	}
}
