import * as vscode from 'vscode-languageserver';
import { ConfigurationHost } from '@volar/vue-language-service';

export function createLsConfigs(rootFolderUris: string[], connection: vscode.Connection): ConfigurationHost {

	let settings: Record<string, Record<string, Promise<any>>> = {};

	const callbacks: Function[] = []

	connection.onDidChangeConfiguration(async () => {
		settings = {};
		for (const cb of callbacks) {
			cb();
		}
	});

	return {
		async getConfiguration(section, scopeUri) {
			if (!settings[section]) {
				settings[section] = {};
			}
			const uri = scopeUri ?? '';
			if (!settings[section][uri]) {
				settings[section][uri] = (async () => await connection.workspace.getConfiguration({ scopeUri, section }) ?? undefined)();
			}
			return settings[section][uri];
		},
		onDidChangeConfiguration(cb) {
			callbacks.push(cb);
		},
		rootUris: rootFolderUris,
	};
}
