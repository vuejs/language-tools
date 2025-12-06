import type { TextDocument } from '@volar/language-server';
import { afterEach, expect, test } from 'vitest';
import { URI } from 'vscode-uri';
import { getLanguageServer, testWorkspacePath } from './server.js';

const openedDocuments: TextDocument[] = [];

afterEach(async () => {
	const server = await getLanguageServer();
	for (const document of openedDocuments) {
		await server.close(document.uri);
	}
	openedDocuments.length = 0;
});

test('#5572 semantic tokens stay in sync when a git view is opened', async () => {
	const server = await getLanguageServer();
	const fileContent = `
<script setup lang="ts">
defineProps({
    foo: { type: String },
});
</script>
	`;
	const fileUri = URI.file(`${testWorkspacePath}/semanticTokens.vue`);

	const document = await prepareDocument(fileUri, 'vue', fileContent);
	const tokensBefore = (await server.vueserver.sendSemanticTokensRequest(document.uri))!.data;

	// simlulate open git diff view
	const gitUri = URI.from({ scheme: 'git', path: fileUri.path });
	await prepareDocument(gitUri, 'vue', fileContent.replace('foo', 'fooooooo'));

	const tokensAfter = (await server.vueserver.sendSemanticTokensRequest(document.uri))!.data;

	expect(tokensAfter).toEqual(tokensBefore);
});

async function prepareDocument(uriOrFileName: string | URI, languageId: string, content: string) {
	const server = await getLanguageServer();
	const uri = typeof uriOrFileName === 'string'
		? URI.file(`${testWorkspacePath}/${uriOrFileName}`)
		: uriOrFileName;
	const document = await server.open(uri.toString(), languageId, content);
	if (openedDocuments.every(d => d.uri !== document.uri)) {
		openedDocuments.push(document);
	}
	return document;
}
