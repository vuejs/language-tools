import type { TextDocument } from '@volar/language-server';
import { AutoInsertRequest } from '@volar/language-server/protocol';
import { afterEach, expect, test } from 'vitest';
import { URI } from 'vscode-uri';
import { getLanguageServer, testWorkspacePath } from './server';

test('.value after a ref', async () => {
	expect(
		await requestAutoInsert(
			'tsconfigProject/fixture.vue',
			`
			<script setup lang="ts">
			import { ref } from 'vue';
			const count = ref(0);
			count|
			</script>
			`,
		),
	).toBe('${1:.value}');
});

test('No .value after a non-ref', async () => {
	expect(
		await requestAutoInsert(
			'tsconfigProject/fixture.vue',
			`
			<script setup lang="ts">
			const count = 0;
			count|
			</script>
			`,
		),
	).toBeFalsy();
});

const openedDocuments: TextDocument[] = [];

afterEach(async () => {
	const server = await getLanguageServer();
	for (const document of openedDocuments) {
		await server.close(document.uri);
	}
	openedDocuments.length = 0;
});

/** Opens `content` with its `|` removed, as if the character before `|` was just typed. */
async function requestAutoInsert(fileName: string, content: string) {
	const offset = content.indexOf('|');
	expect(offset).toBeGreaterThan(0);
	content = content.slice(0, offset) + content.slice(offset + 1);

	const server = await getLanguageServer();
	const uri = URI.file(`${testWorkspacePath}/${fileName}`);
	const document = await server.open(uri.toString(), 'vue', content);
	openedDocuments.push(document);

	return await server.vueserver.connection.sendRequest(AutoInsertRequest.type, {
		textDocument: { uri: document.uri },
		selection: document.positionAt(offset),
		change: {
			rangeOffset: offset - 1,
			rangeLength: 0,
			text: content[offset - 1]!,
		},
	});
}
