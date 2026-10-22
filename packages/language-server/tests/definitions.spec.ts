import type { Location, TextDocument } from '@volar/language-server';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { URI } from 'vscode-uri';
import { getLanguageServer, testWorkspacePath } from './server';

test('TS to vue', async () => {
	expect(
		await requestDefinition('tsconfigProject/fixture1.ts', 'typescript', `import C|omponent from './empty.vue';`),
	).toMatchInlineSnapshot(`
		[
		  {
		    "end": {
		      "line": 1,
		      "offset": 1,
		    },
		    "file": "\${testWorkspacePath}/tsconfigProject/empty.vue",
		    "start": {
		      "line": 1,
		      "offset": 1,
		    },
		  },
		]
	`);
	expect(
		await requestDefinition('tsconfigProject/fixture2.ts', 'typescript', `import Component from '|./empty.vue';`),
	).toMatchInlineSnapshot(`
		[
		  {
		    "end": {
		      "line": 1,
		      "offset": 1,
		    },
		    "file": "\${testWorkspacePath}/tsconfigProject/empty.vue",
		    "start": {
		      "line": 1,
		      "offset": 1,
		    },
		  },
		]
	`);
});

test('Alias path', async () => {
	await prepareDocument('tsconfigProject/foo.ts', 'typescript', `export const foo = 'foo';`);
	expect(
		await requestDefinition(
			'tsconfigProject/fixture.vue',
			'vue',
			`
			<script setup lang="ts">
			import { foo| } from '@/foo';
			</script>
		`,
		),
	).toMatchInlineSnapshot(`
		[
		  {
		    "contextEnd": {
		      "line": 1,
		      "offset": 26,
		    },
		    "contextStart": {
		      "line": 1,
		      "offset": 1,
		    },
		    "end": {
		      "line": 1,
		      "offset": 17,
		    },
		    "file": "\${testWorkspacePath}/tsconfigProject/foo.ts",
		    "start": {
		      "line": 1,
		      "offset": 14,
		    },
		  },
		]
	`);
});

test('#2600', async () => {
	await prepareDocument(
		'tsconfigProject/foo.vue',
		'vue',
		`
		<template>
			<h1>{{ msg }}</h1>
		</template>

		<script lang="ts">
		export default defineProps<{ msg: string }>()
		</script>
	`,
	);
	expect(
		await requestDefinition(
			'tsconfigProject/fixture.vue',
			'vue',
			`
			<script setup lang="ts">
			import Foo from '|@/foo.vue';
			</script>
		`,
		),
	).toMatchInlineSnapshot(`
		[
		  {
		    "end": {
		      "line": 8,
		      "offset": 3,
		    },
		    "file": "\${testWorkspacePath}/tsconfigProject/foo.vue",
		    "start": {
		      "line": 7,
		      "offset": 3,
		    },
		  },
		]
	`);
});

test('global component tags lead to the file declaring the component', async () => {
	expect(await requestVueDefinitions('ParentGlobal.vue', '<GlobalChild', 1)).toEqual(['Child.vue 0:0-0:0']);
	expect(await requestVueDefinitions('ParentGlobal.vue', '<GlobalTsChild', 1)).toEqual([
		'tsChild.ts 2:13-2:20',
	]);
	expect(await requestVueDefinitions('ParentGlobal.vue', '</GlobalTsChild', 2)).toEqual([
		'tsChild.ts 2:13-2:20',
	]);
	expect(await requestVueDefinitions('ParentNamespace.vue', '<Foo.Bar', 5)).toEqual(['Child.vue 0:0-0:0']);
});

test('component tags declared in the file itself have no definition from the Vue language server', async () => {
	expect(await requestVueDefinitions('ParentLocal.vue', '<Local', 1)).toEqual([]);
});

/** The Vue language server's definitions at `search` + `delta` of a file in `hoverComponentMeta`, as it is on disk. */
async function requestVueDefinitions(file: string, search: string, delta: number) {
	const fileName = `${testWorkspacePath}/hoverComponentMeta/${file}`;
	const content = fs.readFileSync(fileName, 'utf8');
	const server = await getLanguageServer();
	const document = await prepareDocument(`hoverComponentMeta/${file}`, 'vue', content);
	const definitions = await server.vueserver.sendDefinitionRequest(
		document.uri,
		document.positionAt(content.indexOf(search) + delta),
	) ?? [];
	return [definitions].flat().map(definition => {
		// Without link support in the client, the server answers locations.
		const { uri, range: { start, end } } = 'targetUri' in definition
			? { uri: definition.targetUri, range: definition.targetSelectionRange }
			: definition as Location;
		return `${path.basename(URI.parse(uri).fsPath)} ${start.line}:${start.character}-${end.line}:${end.character}`;
	});
}

const openedDocuments: TextDocument[] = [];

afterEach(async () => {
	const server = await getLanguageServer();
	for (const document of openedDocuments) {
		await server.close(document.uri);
	}
	openedDocuments.length = 0;
});

async function requestDefinition(fileName: string, languageId: string, content: string) {
	const offset = content.indexOf('|');
	expect(offset).toBeGreaterThanOrEqual(0);
	content = content.slice(0, offset) + content.slice(offset + 1);

	const server = await getLanguageServer();
	let document = await prepareDocument(fileName, languageId, content);

	const res = await server.tsserver.message({
		seq: server.nextSeq(),
		command: 'definition',
		arguments: {
			file: URI.parse(document.uri).fsPath,
			position: offset,
		},
	});
	expect(res.success).toBe(true);

	for (const ref of res.body) {
		ref.file = '${testWorkspacePath}' + ref.file.slice(testWorkspacePath.length);
	}

	return res.body;
}

async function prepareDocument(fileName: string, languageId: string, content: string) {
	const server = await getLanguageServer();
	const uri = URI.file(`${testWorkspacePath}/${fileName}`);
	const document = await server.open(uri.toString(), languageId, content);
	if (openedDocuments.every(d => d.uri !== document.uri)) {
		openedDocuments.push(document);
	}
	return document;
}
