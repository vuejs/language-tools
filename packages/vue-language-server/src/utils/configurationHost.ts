import * as vscode from 'vscode-languageserver';
import { ConfigurationHost } from '@volar/vue-language-service';
import { URI } from 'vscode-uri';

export function createConfigurationHost(params: vscode.InitializeParams, rootUris: URI[], connection: vscode.Connection): ConfigurationHost & { ready(): void; } {

	let settings: Record<string, Record<string, Promise<any>>> = {};
	let watchingChange = false;

	const callbacks: Function[] = [];

	connection.onDidChangeConfiguration(async () => {
		settings = {};
		for (const cb of callbacks) {
			cb();
		}
	});

	return {
		ready() {
			if (params.capabilities.workspace?.didChangeConfiguration?.dynamicRegistration) {
				connection.client.register(vscode.DidChangeConfigurationNotification.type);
				watchingChange = true;
			}
		},
		async getConfiguration(section, scopeUri) {
			if (!settings[section]) {
				settings[section] = {};
			}
			const uri = scopeUri ?? '';
			if (!settings[section][uri] || !watchingChange) {
				settings[section][uri] = (async () => await connection.workspace.getConfiguration({ scopeUri, section }) ?? undefined)();
			}
			return settings[section][uri];
		},
		onDidChangeConfiguration(cb) {
			callbacks.push(cb);
		},
		rootUris: rootUris.map(uri => uri.toString()),
	};
}
