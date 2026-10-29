import * as fs from 'node:fs';
import * as path from 'node:path';
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

	const hover = await server.typescript('textDocument/hover', {
		textDocument: { uri: document.uri },
		position: document.positionAt(offset),
	});

	await server.close(document.uri);

	expect(hover?.contents?.value).toContain('var Math: Math');
});

test('rich hover of a component tag shows its meta from the TypeScript language server', async () => {
	const value = await getRichHover('Parent.vue', 'Child');

	expect(value).toContain('label');
	expect(value).toContain('The label');
	expect(value).toContain(`<code>'hello'</code>`);
	expect(value).toContain('change');
});

test('rich hover of a global component declared with typeof import()', async () => {
	const value = await getRichHover('ParentGlobal.vue', 'GlobalChild');

	expect(value).toContain('The label');
	expect(value).toContain(`<code>'hello'</code>`);
	expect(value).toContain('change');
});

test('rich hover of a namespaced component', async () => {
	const value = await getRichHover('ParentNamespace.vue', 'Foo.Bar');

	expect(value).toContain('The label');
	expect(value).toContain(`<code>'hello'</code>`);
	expect(value).toContain('change');
});

test('rich hover of a component that is not exported', async () => {
	const value = await getRichHover('ParentLocal.vue', 'Local');

	expect(value).toContain('The local label');
	expect(value).toContain(`<code>'local'</code>`);
	expect(value).toContain('change');
});

test('rich hover of a component tag follows the binding the template checks against', async () => {
	const shadowing = await getRichHover('ParentShadow.vue', 'GlobalChild');
	expect(shadowing).toContain('The shadowing label');
	expect(shadowing).not.toContain('The label');

	// `<loading>` refers to `Loading`, as `@vue/compiler-sfc` tries the PascalCase name first.
	expect(await getRichHover('ParentCasing.vue', 'loading')).toContain('The label');
});

test('rich hover of a Vue file referring to itself by its `defineOptions` name', async () => {
	expect(await getRichHover('SelfNamed.vue', 'Named')).toContain('The named label');
});

async function getRichHover(file: string, tag: string) {
	const fileName = path.join(testWorkspacePath, 'hoverComponentMeta', file);
	// The TypeScript language server reads the file from disk, so the document must match it.
	const content = fs.readFileSync(fileName, 'utf8');

	const server = await getLanguageServer();
	const document = await server.open(URI.file(fileName).toString(), 'vue', content);
	try {
		const hover = await server.vueserver.sendHoverRequest(
			document.uri,
			document.positionAt(content.indexOf('<' + tag) + 2),
		);
		const contents = hover?.contents as { kind: string; value: string } | undefined;
		expect(contents?.kind).toBe('markdown');
		return contents?.value;
	}
	finally {
		await server.close(document.uri);
	}
}
