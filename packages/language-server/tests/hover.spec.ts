import { expect, test } from 'vitest';
import { URI } from 'vscode-uri';
import { getLanguageServer, testWorkspacePath } from './server';

test('global at leading code is not cut', async () => {
	const content = `<template>
	{{Math.max(foo)}}
</template>

<script setup lang="ts">
const foo = 1;
</script>`;
	const offset = content.indexOf('Math');

	const server = await getLanguageServer();
	const document = await server.open(
		URI.file(`${testWorkspacePath}/tsconfigProject/fixture.vue`).toString(),
		'vue',
		content,
	);

	const res = await server.tsserver.message({
		seq: server.nextSeq(),
		command: 'quickinfo',
		arguments: {
			file: URI.parse(document.uri).fsPath,
			position: offset,
		},
	});

	await server.close(document.uri);

	expect(res.success).toBe(true);
	expect(res.body?.displayString).toBe('var Math: Math');
});

test.each([
	'ref(1)',
	'computed(() => 1)',
	'computed({ get: () => 1, set: (_value: string) => {} })',
])('setup binding documentation with %s', async initializer => {
	const content = `<script setup lang="ts">
import { computed, ref } from 'vue';
/** Number of selected rows. */
const count = ${initializer};
</script>
<template>{{ count }}</template>`;

	const server = await getLanguageServer();
	const document = await server.open(
		URI.file(`${testWorkspacePath}/tsconfigProject/fixture.vue`).toString(),
		'vue',
		content,
	);

	const res = await server.tsserver.message({
		seq: server.nextSeq(),
		command: 'quickinfo',
		arguments: {
			file: URI.parse(document.uri).fsPath,
			position: content.lastIndexOf('count') + 2,
		},
	});

	await server.close(document.uri);

	expect(res.success).toBe(true);
	expect(res.body?.documentation).toBe('Number of selected rows.');
	expect(res.body?.displayString).toContain('value: number');
	expect(res.body?.displayString).not.toContain('const count');
});
