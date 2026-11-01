import { expect, test } from 'vitest';
import { getLanguageServer } from './server';

// VS Code uses a single semantic tokens provider per document, so providing any would shadow TypeScript's.
test('does not provide semantic tokens', async () => {
	const server = await getLanguageServer();

	expect(server.initializeResult.capabilities.semanticTokensProvider).toBeUndefined();
});
