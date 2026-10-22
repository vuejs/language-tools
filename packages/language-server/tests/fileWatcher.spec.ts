import { ConfigurationRequest, DidChangeWatchedFilesNotification, RegistrationRequest } from '@volar/language-server';
import { type LanguageServerHandle, startLanguageServer } from '@volar/test-utils';
import { afterAll, expect, test } from 'vitest';
import { URI } from 'vscode-uri';
import { testWorkspacePath } from './server';

let vueServer: LanguageServerHandle | undefined;

afterAll(async () => {
	await vueServer?.shutdown();
});

test('all files are watched so project services and auto-import components pick up changes', async () => {
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
	await vueServer.initialize(URI.file(testWorkspacePath).toString(), {}, {
		workspace: { configuration: true, didChangeWatchedFiles: { dynamicRegistration: true } },
	});
	await expect.poll(() => watchers).toContainEqual({ globPattern: '**/*' });
});
