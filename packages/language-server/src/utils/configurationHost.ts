import * as vscode from 'vscode-languageserver';
import { ConfigurationHost } from '@volar/vue-language-service';

export function createConfigurationHost(params: vscode.InitializeParams, connection: vscode.Connection): ConfigurationHost & { ready(): void; } {

	const callbacks: Function[] = [];

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
			return (await connection.workspace.getConfiguration({ scopeUri, section })) ?? undefined /* replace null to undefined */;
		},
		onDidChangeConfiguration(cb) {
			callbacks.push(cb);
		},
	};
}
