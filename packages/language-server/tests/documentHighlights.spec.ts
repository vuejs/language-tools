import { DocumentHighlightRequest } from '@volar/language-server';
import { expect, test } from 'vitest';
import { URI } from 'vscode-uri';
import { getLanguageServer, testWorkspacePath } from './server';

test('#5487 #5580 tag names highlight only their matching tag', async () => {
	expect(
		await highlight(`
<script setup lang="ts">
import Comp from './Comp.vue';
</script>

<template>
	<div>
		<d|iv></div>
	</div>
	<Comp></Comp>
	<Comp></Comp>
</template>
`),
	).toEqual(['div', 'div']);
	expect(
		await highlight(`
<script setup lang="ts">
import Comp from './Comp.vue';
</script>

<template>
	<div><div></div></div>
	<Co|mp></Comp>
	<Comp></Comp>
</template>
`),
	).toEqual(['Comp', 'Comp']);
});

test('pug tag names highlight their matching tag', async () => {
	expect(
		await highlight(
			`
<template lang="pug">
d|iv
	div
span
</template>
`,
			'content-mapper-pug/App.vue',
		),
	).toEqual(['div']);
});

test('embedded TypeScript is left to the TypeScript server', async () => {
	const content = `
<script setup lang="ts">
const msg = 'hi';
function onClick() {}
</script>

<template>
	<div v-if="msg" :title="msg" @click="onClick">{{ msg }}</div>
</template>
`;
	const positions = [
		content.indexOf('msg ='),
		content.indexOf('onClick()'),
		content.indexOf('msg" :'),
		content.indexOf('msg" @'),
		content.indexOf('onClick"'),
		content.indexOf('msg }}'),
	];
	for (const position of positions) {
		expect(
			await highlight(content.slice(0, position) + '|' + content.slice(position)),
			content.slice(position, position + 8),
		)
			.toEqual([]);
	}
});

test('CSS and SFC block tags keep their highlights', async () => {
	const content = `
<script setup lang="ts">
</script>

<style>
.a { color: red; }
.a { color: blue; }
</style>
`;
	const at = (search: string, delta: number) => {
		const position = content.indexOf(search) + delta;
		return content.slice(0, position) + '|' + content.slice(position);
	};
	expect(await highlight(at('.a', 1))).toEqual(['.a', '.a']);
	expect(await highlight(at('style>', 1))).toEqual(['style', 'style']);
});

async function highlight(content: string, file = 'documentHighlights.vue') {
	const server = await getLanguageServer();
	const offset = content.indexOf('|');
	content = content.slice(0, offset) + content.slice(offset + 1);
	const uri = URI.file(`${testWorkspacePath}/${file}`).toString();
	const document = await server.open(uri, 'vue', content);
	try {
		const highlights = await server.vueserver.connection.sendRequest(DocumentHighlightRequest.type, {
			textDocument: { uri: document.uri },
			position: document.positionAt(offset),
		});
		return (highlights ?? [])
			.sort((a, b) => document.offsetAt(a.range.start) - document.offsetAt(b.range.start))
			.map(({ range }) => document.getText(range));
	}
	finally {
		await server.close(document.uri);
	}
}
