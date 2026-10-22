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

test('nothing outside template tag names is highlighted', async () => {
	const content = `
<script setup lang="ts">
const msg = 'hi';
</script>

<template>
	<div :title="msg">{{ msg }}</div>
</template>

<style>
.a { color: red; }
.a { color: blue; }
</style>
`;
	const positions = [
		content.indexOf('msg ='),
		content.indexOf('msg"'),
		content.indexOf('msg }}'),
		content.indexOf('title'),
		content.indexOf('.a') + 1,
		content.indexOf('script setup'),
		content.indexOf('template>'),
	];
	for (const position of positions) {
		expect(
			await highlight(content.slice(0, position) + '|' + content.slice(position)),
			content.slice(position, position + 8),
		)
			.toEqual([]);
	}
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
