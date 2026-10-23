import type { TextDocument, TextDocumentEdit } from '@volar/language-server';
import { afterEach, expect, test } from 'vitest';
import { URI } from 'vscode-uri';
import { getLanguageServer, testWorkspacePath } from './server';

const openedDocuments: TextDocument[] = [];

afterEach(async () => {
	const server = await getLanguageServer();
	for (const document of openedDocuments) {
		await server.close(document.uri);
	}
	openedDocuments.length = 0;
});

test('Extract into new dumb component', async () => {
	expect(
		await requestExtractedComponent(
			'tsconfigProject/fixture.vue',
			`
<template>
	<div>[<span>{{ msg }}</span><input v-model="count" />]</div>
</template>

<script lang="ts">
export default {
	props: { msg: { type: String, required: true } },
	data: () => ({ count: 0 }),
};
</script>
`,
		),
	).toMatchInlineSnapshot(`
		"<template>
			<span>{{ msg }}</span><input v-model="count" />
		</template>

		<script setup lang="ts">
		defineProps<{
			msg: string;
			count: number;
		}>()
		</script>
		"
	`);
});

/** The content of the component extracted from the template code between `[` and `]`. */
async function requestExtractedComponent(fileName: string, content: string) {
	const start = content.indexOf('[');
	const end = content.indexOf(']') - 1;
	content = content.replace('[', '').replace(']', '');

	const server = await getLanguageServer();
	const uri = URI.file(`${testWorkspacePath}/${fileName}`);
	const document = await server.open(uri.toString(), 'vue', content);
	openedDocuments.push(document);

	const codeActions = await server.vueserver.sendCodeActionsRequest(
		document.uri,
		{ start: document.positionAt(start), end: document.positionAt(end) },
		{ diagnostics: [], only: ['refactor'] },
	);
	const codeAction = codeActions?.find(action =>
		'title' in action && action.title === 'Extract into new dumb component'
	);
	expect(codeAction).toBeDefined();

	const resolved = await server.vueserver.sendCodeActionResolveRequest(codeAction as any);
	const newFileEdit = resolved.edit?.documentChanges?.find(
		(change): change is TextDocumentEdit =>
			'textDocument' in change && change.textDocument.uri.endsWith('/NewComponent.vue'),
	);
	return newFileEdit?.edits[0]?.newText;
}
