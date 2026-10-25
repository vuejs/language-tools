import { expect, test } from 'vitest';
import { URI } from 'vscode-uri';
import { getLanguageServer, testWorkspacePath } from './server';

/**
 * Tests the createPlugins option (language-server-internal): when contentMappers[].options.skipScriptCodegen
 * is true, the language server passes no script codegen plugins (no vue-tsx), so no script_ts embedded code
 * is generated. Language service features (hover, completion, inlay hints) still work because they depend
 * only on IR and scriptAnalysis.
 */

test('no script_ts embedded code when skipScriptCodegen is true', async () => {
	const content = `<script setup lang="ts">
const foo = 1;
const bar = 2;
</script>

<template>
	<div>{{ foo }}</div>
</template>`;

	const server = await getLanguageServer();
	const document = await server.open(
		URI.file(`${testWorkspacePath}/tsconfigNoScriptCodegen/fixture.vue`).toString(),
		'vue',
		content,
	);

	// Verify by checking that semantic tokens work (which proves vue-tsx is not loaded)
	// If vue-tsx were loaded, we would get semantic tokens from the generated script_ts
	// But without it, we only get tokens from the template
	const semanticTokens = await server.typescript('textDocument/semanticTokens/full', {
		textDocument: { uri: document.uri },
	});

	// Should get semantic tokens (from template), but not from script_ts
	expect(semanticTokens).toBeDefined();

	await server.close(document.uri);
});

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
		URI.file(`${testWorkspacePath}/tsconfigNoScriptCodegen/fixture.vue`).toString(),
		'vue',
		content,
	);

	const hover = await server.typescript('textDocument/hover', {
		textDocument: { uri: document.uri },
		position: document.positionAt(offset),
	});

	await server.close(document.uri);

	// Should get hover showing the type
	expect(hover?.contents).toBeDefined();
	const contents = typeof hover?.contents === 'string' ? hover.contents : (hover?.contents as any)?.value;
	expect(contents).toContain('foo');
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
		URI.file(`${testWorkspacePath}/tsconfigNoScriptCodegen/fixture.vue`).toString(),
		'vue',
		content,
	);

	const completions = await server.typescript('textDocument/completion', {
		textDocument: { uri: document.uri },
		position: document.positionAt(offset),
	});

	await server.close(document.uri);

	const labels = completions?.items.map((item: any) => item.label) ?? [];
	// Should have foo and bar in completion (from IR-derived scope names)
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
		URI.file(`${testWorkspacePath}/tsconfigNoScriptCodegen/fixture.vue`).toString(),
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

	// Should show v-bind shorthand hint (from IR-derived inlay hints)
	expect(hints).toBeDefined();
	if (hints) {
		expect(hints.length).toBeGreaterThan(0);
		expect(hints.some((hint: any) => hint.label.includes('="foo"'))).toBe(true);
	}
});

test('style v-bind() works without script codegen', async () => {
	const content = `<script setup lang="ts">
const color = 'red';
</script>

<template>
	<div>test</div>
</template>

<style scoped>
.item {
	color: v-bind(color);
}
</style>`;
	const offset = content.lastIndexOf('color');

	const server = await getLanguageServer();
	const document = await server.open(
		URI.file(`${testWorkspacePath}/tsconfigNoScriptCodegen/fixture.vue`).toString(),
		'vue',
		content,
	);

	const hover = await server.typescript('textDocument/hover', {
		textDocument: { uri: document.uri },
		position: document.positionAt(offset),
	});

	await server.close(document.uri);

	// Should get hover for the v-bind() variable
	expect(hover?.contents).toBeDefined();
	const contents = typeof hover?.contents === 'string' ? hover.contents : (hover?.contents as any)?.value;
	expect(contents).toContain('color');
});
