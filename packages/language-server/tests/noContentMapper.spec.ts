import { startLanguageServer } from '@volar/test-utils';
import { afterAll, expect, test } from 'vitest';
import { URI } from 'vscode-uri';
import { type LspServer, startLspServer } from '../../content-mapper/tests/lsp';
import { testWorkspacePath, typescriptPackageJsonPath } from './server';

const vueserver = startLanguageServer(require.resolve('../index.js'), testWorkspacePath);
let typescriptServer: Promise<LspServer> | undefined;

vueserver.connection.onRequest('vue/typescriptApiConnection', async () => {
	const server = await (typescriptServer ??= startLspServer(testWorkspacePath));
	const { pipe } = await server.request<{ pipe: string }>('custom/initializeAPISession', {});
	return { pipe, packageJsonPath: typescriptPackageJsonPath };
});

afterAll(async () => {
	await vueserver.shutdown();
	(await typescriptServer)?.close();
});

test('a .vue file no @vue/content-mapper entry covers gets no Vue language features', async () => {
	await vueserver.initialize(URI.file(testWorkspacePath).toString(), {});
	const uri = URI.file(`${testWorkspacePath}/fixture.vue`).toString();
	await vueserver.openInMemoryDocument(uri, 'vue', '<');
	const completions = await vueserver.sendCompletionRequest(uri, { line: 0, character: 1 });
	expect(completions?.items.map(item => item.label) ?? []).not.toContain('template');
});
