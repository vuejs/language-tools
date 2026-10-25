import { expect, test } from 'vitest';
import { URI } from 'vscode-uri';
import { getLanguageServer, testWorkspacePath } from './server';

test('template hover works without script codegen', async () => {
	const content = `<script setup lang="ts">
const foo = 1;
</script>

<template>
	<div>{{ foo }}</div>
</template>`;
	const offset = content.lastIndexOf('foo');

	const server = await getLanguageServer();
	const document = await server.open(
		URI.file(`${testWorkspacePath}/skipScriptCodegen/fixture.vue`).toString(),
		'vue',
		content,
	);

	const hover = await server.typescript('textDocument/hover', {
		textDocument: { uri: document.uri },
		position: document.positionAt(offset),
	});

	await server.close(document.uri);

	// Should still get hover for template variable
	expect(hover?.contents).toBeDefined();
});

test('template completions work without script codegen', async () => {
	const content = `<script setup lang="ts">
const foo = 1;
const bar = 2;
</script>

<template>
	<div>{{ f }}</div>
</template>`;
	const offset = content.indexOf('{{ f') + 3;

	const server = await getLanguageServer();
	const document = await server.open(
		URI.file(`${testWorkspacePath}/skipScriptCodegen/fixture.vue`).toString(),
		'vue',
		content,
	);

	const completions = await server.typescript('textDocument/completion', {
		textDocument: { uri: document.uri },
		position: document.positionAt(offset),
	});

	await server.close(document.uri);

	const labels = completions?.items.map((item: any) => item.label) ?? [];
	// Should have foo and bar in completion
	expect(labels).toContain('foo');
	expect(labels).toContain('bar');
});

test('template inlay hints work without script codegen', async () => {
	const content = `<script setup lang="ts">
const foo = 1;
</script>

<template>
	<div :foo></div>
</template>`;

	const server = await getLanguageServer();
	const document = await server.open(
		URI.file(`${testWorkspacePath}/skipScriptCodegen/fixture.vue`).toString(),
		'vue',
		content,
	);

	const hints = await server.typescript('textDocument/inlayHint', {
		textDocument: { uri: document.uri },
		range: {
			start: { line: 0, character: 0 },
			end: { line: 7, character: 0 },
		},
	});

	await server.close(document.uri);

	// Should still show v-bind shorthand hint
	expect(hints).toBeDefined();
	if (hints) {
		expect(hints.length).toBeGreaterThan(0);
		expect(hints.some((hint: any) => hint.label.includes('="foo"'))).toBe(true);
	}
});
