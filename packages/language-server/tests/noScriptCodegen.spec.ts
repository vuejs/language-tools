import { TextDocument } from '@volar/language-server';
import { AutoInsertRequest, type GetVirtualFileRequest } from '@volar/language-server/protocol';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, test } from 'vitest';
import { URI } from 'vscode-uri';
import { getLanguageServer, testWorkspacePath } from './server';

// The language server features read the Vue source and its IR, not the code that a script code generation
// plugin generates for TypeScript 7.1, so they work when the server creates no such plugin. This server cannot
// resolve @vue/content-mapper, the package of the only such plugin.
const serverModule = require.resolve('./noScriptCodegenServer.js');

test('creates no script embedded code', async () => {
	const { document } = await openFixture('templateScope', 'fixture.vue');
	const server = await getLanguageServer(serverModule);
	try {
		const ids = await getEmbeddedCodeIds(serverModule, document.uri);
		expect(ids).toContain('template');
		expect(ids.filter(id => id.startsWith('script_'))).toEqual([]);
	}
	finally {
		await server.close(document.uri);
	}
	// what the server creates by default
	const defaultServer = await getLanguageServer();
	await defaultServer.open(document.uri, 'vue', document.getText());
	try {
		expect(await getEmbeddedCodeIds(undefined, document.uri)).toContain('script_ts');
	}
	finally {
		await defaultServer.close(document.uri);
	}
});

test('completes the setup bindings that the template scope does not list', async () => {
	const { document, content } = await openFixture('templateScope', 'fixture.vue');
	const server = await getLanguageServer(serverModule);
	try {
		const completion = await server.vueserver.sendCompletionRequest(
			document.uri,
			document.positionAt(content.indexOf('{{ title + ') + '{{ title + '.length),
		);
		const labels = completion?.items.map(item => item.label) ?? [];
		// `count` and `title` are read by the template and `color` by the style `v-bind()`, so the template scope
		// of TypeScript lists them.
		expect(labels).toContain('unused');
		expect(labels).toContain('typeof');
		expect(labels).not.toContain('count');
		expect(labels).not.toContain('title');
		expect(labels).not.toContain('color');
	}
	finally {
		await server.close(document.uri);
	}
});

test('offers no Emmet abbreviation in template expressions', async () => {
	const content = `<script setup lang="ts">
const ul = 1;
</script>

<template>
	<p :title="ul" @click="ul">{{ ul }}</p>
	<p v-if="ul">{{ ul ? ul : 1 }}</p>
	<p>ul</p>
</template>
`;
	const server = await getLanguageServer(serverModule);
	const uri = URI.file(path.join(testWorkspacePath, 'templateScope', 'emmet.vue')).toString();
	const document = await server.open(uri, 'vue', content);
	try {
		const getEmmetLabels = async (textBefore: string) => {
			const completion = await server.vueserver.sendCompletionRequest(
				uri,
				document.positionAt(content.indexOf(textBefore) + textBefore.length),
			);
			return completion?.items.filter(item => item.detail === 'Emmet Abbreviation').map(item => item.label);
		};
		expect(await getEmmetLabels('<p>ul')).toEqual(['ul']);
		expect(await getEmmetLabels('{{ ul')).toEqual([]);
		expect(await getEmmetLabels('{{ ul ? ul')).toEqual([]);
		expect(await getEmmetLabels(':title="ul')).toEqual([]);
		expect(await getEmmetLabels('@click="ul')).toEqual([]);
		expect(await getEmmetLabels('v-if="ul')).toEqual([]);
	}
	finally {
		await server.close(uri);
	}
});

test('closes the HTML tag of the template', async () => {
	expect(
		await requestAutoInsert(serverModule, `<script setup lang="ts">
const title = 'hello';
</script>

<template>
	<div>|
</template>
`),
	).toBe('$0</div>');
});

test('closes the JSX tag of the script', async () => {
	const content = `<script setup lang="tsx">
const vnode = <div>|;
</script>
`;
	expect(await requestAutoInsert(serverModule, content)).toBe('$0</div>');
	expect(await requestAutoInsert(undefined, content)).toBe('$0</div>');
});

test('completes the JSDoc comment template of the script', async () => {
	const content = `<script setup lang="ts">
/** */
function add(a: number) {}
</script>
`;
	const completeJsDoc = async (entry: string | undefined) => {
		const server = await getLanguageServer(entry);
		const uri = URI.file(path.join(testWorkspacePath, 'templateScope', 'jsdoc.vue')).toString();
		const document = await server.open(uri, 'vue', content);
		try {
			const completion = await server.vueserver.sendCompletionRequest(
				uri,
				document.positionAt(content.indexOf('/**') + '/**'.length),
			);
			return completion?.items.map(item => [item.label, item.textEdit?.newText]);
		}
		finally {
			await server.close(uri);
		}
	};
	const items = [['/** */', '/**\n * $0\n * @param a ${1}\n */']];
	expect(await completeJsDoc(serverModule)).toEqual(items);
	// one item on the default server, too
	expect(await completeJsDoc(undefined)).toEqual(items);
});

test('formats the script block', async () => {
	const content = `<script setup lang="ts">
function add(a: number) {
const sum   =  a+1;
return sum;
}
</script>
`;
	const formatted = `<script setup lang="ts">
function add(a: number) {
	const sum = a + 1;
	return sum;
}
</script>
`;
	expect(await format(serverModule, content)).toBe(formatted);
	// formats once on the default server, too
	expect(await format(undefined, content)).toBe(formatted);
});

test('provides the inlay hints of the template', async () => {
	const { document, content } = await openFixture('templateScope', 'fixture.vue');
	const server = await getLanguageServer(serverModule);
	try {
		const hints = await server.vueserver.sendInlayHintRequest(document.uri, {
			start: document.positionAt(0),
			end: document.positionAt(content.length),
		});
		expect(hints?.map(hint => [document.offsetAt(hint.position), hint.label])).toEqual([
			[content.indexOf('count++'), '$event =>'],
			[content.indexOf(':title') + ':title'.length, '="title"'],
		]);
	}
	finally {
		await server.close(document.uri);
	}
});

test('provides the rich hover of a component tag', async () => {
	const { document, content } = await openFixture('hoverComponentMeta', 'Parent.vue');
	const server = await getLanguageServer(serverModule);
	try {
		const hover = await server.vueserver.sendHoverRequest(
			document.uri,
			document.positionAt(content.indexOf('<Child') + 2),
		);
		const contents = hover?.contents as { kind: string; value: string } | undefined;
		expect(contents?.kind).toBe('markdown');
		expect(contents?.value).toContain('The label');
	}
	finally {
		await server.close(document.uri);
	}
});

async function getEmbeddedCodeIds(entry: string | undefined, uri: string) {
	const server = await getLanguageServer(entry);
	const tree = await server.vueserver.connection.sendRequest<GetVirtualFileRequest.ResponseType>(
		'volar/client/virtualFiles',
		{ uri },
	);
	const ids: string[] = [];
	const collect = (code: NonNullable<GetVirtualFileRequest.ResponseType>) => {
		ids.push(code.virtualCodeId);
		code.embeddedCodes.forEach(collect);
	};
	collect(tree!);
	return ids;
}

/** Opens `content` with its `|` removed, as if the character before `|` was just typed. */
async function requestAutoInsert(entry: string | undefined, content: string) {
	const offset = content.indexOf('|');
	content = content.slice(0, offset) + content.slice(offset + 1);
	const server = await getLanguageServer(entry);
	const uri = URI.file(path.join(testWorkspacePath, 'templateScope', 'autoInsert.vue')).toString();
	const document = await server.open(uri, 'vue', content);
	try {
		return await server.vueserver.connection.sendRequest(AutoInsertRequest.type, {
			textDocument: { uri },
			selection: document.positionAt(offset),
			change: { rangeOffset: offset - 1, rangeLength: 0, text: content[offset - 1]! },
		});
	}
	finally {
		await server.close(uri);
	}
}

async function format(entry: string | undefined, content: string) {
	const server = await getLanguageServer(entry);
	const uri = URI.file(path.join(testWorkspacePath, 'templateScope', 'format.vue')).toString();
	const document = await server.open(uri, 'vue', content);
	try {
		const edits = await server.vueserver.sendDocumentFormattingRequest(uri, { tabSize: 4, insertSpaces: false });
		return TextDocument.applyEdits(document, edits ?? []);
	}
	finally {
		await server.close(uri);
	}
}

async function openFixture(dir: string, file: string) {
	const fileName = path.join(testWorkspacePath, dir, file);
	// The TypeScript language server reads the file from disk, so the document must match it.
	const content = fs.readFileSync(fileName, 'utf8');
	const server = await getLanguageServer(serverModule);
	const document = await server.open(URI.file(fileName).toString(), 'vue', content);
	return { document, content };
}
