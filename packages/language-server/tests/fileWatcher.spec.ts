import { ConfigurationRequest, DidChangeWatchedFilesNotification, RegistrationRequest } from '@volar/language-server';
import { type LanguageServerHandle, startLanguageServer } from '@volar/test-utils';
import { afterAll, expect, test } from 'vitest';
import { URI } from 'vscode-uri';
import { testWorkspacePath } from './server';

let vueServer: LanguageServerHandle | undefined;

afterAll(async () => {
	await vueServer?.shutdown();
});

test('config files and files that can export components are watched', async () => {
	const watchers: unknown[] = [];
	vueServer = startLanguageServer(require.resolve('../index.js'), testWorkspacePath);
	vueServer.connection.onRequest(ConfigurationRequest.type, ({ items }) => items.map(() => null));
	vueServer.connection.onRequest(RegistrationRequest.type, ({ registrations }) => {
		for (const registration of registrations) {
			if (registration.method === DidChangeWatchedFilesNotification.method) {
				watchers.push(...registration.registerOptions.watchers);
			}
		}
	});
	await vueServer.initialize(URI.file(testWorkspacePath).toString(), {
		contentMappers: [{ package: '@vue/content-mapper', extensions: ['.vue'] }],
	}, {
		workspace: { configuration: true, didChangeWatchedFiles: { dynamicRegistration: true } },
	});
	await expect.poll(() => watchers).toContainEqual({ globPattern: '**/*.json' });
	expect(watchers).toContainEqual({ globPattern: '**/*.ts' });
	expect(watchers).toContainEqual({ globPattern: '**/*.mjs' });
	expect(watchers).toContainEqual({ globPattern: '**/*.vue' });
	expect(watchers).not.toContainEqual({ globPattern: '**/*' });
});
