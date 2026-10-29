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

test('setup refs are unwrapped in template', async () => {
	const content = `<script setup lang="ts">
import { computed, ref } from 'vue';
const count = ref(0);
const message = ref('hello');
const double = computed(() => count.value * 2);
let plain = 1;
</script>

<template>
	{{ count }}
	{{ message }}
	{{ double }}
	{{ message.length }}
	{{ plain }}
</template>`;

	const server = await getLanguageServer();
	const document = await server.open(
		URI.file(`${testWorkspacePath}/tsconfigProject/fixture.vue`).toString(),
		'vue',
		content,
	);
	const templateStart = content.indexOf('<template>');
	const hover = async (text: string, from = templateStart) => {
		const res = await server.tsserver.message({
			seq: server.nextSeq(),
			command: 'quickinfo',
			arguments: {
				file: URI.parse(document.uri).fsPath,
				position: content.indexOf(text, from),
			},
		});
		return res.body?.displayString;
	};

	expect(await hover('count.value', 0)).toBe('const count: Ref<number, number>');
	expect(await hover('count }}')).toBe('(property) count: number');
	expect(await hover('message }}')).toBe('(property) message: string');
	expect(await hover('double }}')).toBe('(property) double: number');
	expect(await hover('message.length')).toBe('(property) message: string');
	expect(await hover('plain }}')).toBe('(property) plain: number');

	await server.close(document.uri);
});
