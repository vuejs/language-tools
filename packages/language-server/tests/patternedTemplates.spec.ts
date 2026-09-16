import { afterEach, expect, test } from 'vitest';
import { URI } from 'vscode-uri';
import { getLanguageServer, testWorkspacePath } from './server';

const uri = URI.file(`${testWorkspacePath}/tsconfigProject/patterned-templates.vue`).toString();
afterEach(async () => {
	await (await getLanguageServer()).close(uri);
});

const source = `<script setup lang="ts">
defineProps<{ result: { kind: 'ok'; data: string } | { kind: 'error'; error: Error } }>();
</script>
<template><template v-match="result">
<button v-when="{ kind: 'ok', data: const article } if (article.length)" :title="article" @click="article.toUpperCase()">{{ article }}</button>
<p v-when="{ kind: 'ok', const data }">{{ data }}</p>
<p v-when="{ kind: 'error', const error }">{{ error.message }}</p>
</template></template>`;

async function request(command: string, text: string, offset?: number, extra = {}) {
	const server = await getLanguageServer();
	const document = await server.open(uri, 'vue', text);
	const position = offset === undefined ? undefined : document.positionAt(offset);
	const result = await server.tsserver.message({
		seq: server.nextSeq(),
		type: 'request',
		command,
		arguments: {
			file: URI.parse(uri).fsPath,
			...(position ? { line: position.line + 1, offset: position.character + 1 } : {}),
			...extra,
		},
	});
	expect(result.success).toBe(true);
	return { body: result.body, document };
}

test('pattern bindings have precise hover and guard / element completion', async () => {
	const offset = source.indexOf('article.length');
	const { body } = await request('quickinfo', source, offset);
	expect(body.displayString).toBe('const article: string');
	const completions = await request('completionInfo', source, offset + 'article.'.length);
	expect(completions.body.entries.map((entry: { name: string }) => entry.name)).toContain('toUpperCase');
	expect(completions.body.entries.map((entry: { name: string }) => entry.name)).not.toContain('toFixed');
});

test('definition and rename connect declaration, guard, props, events and children', async () => {
	const { body, document } = await request('definition', source, source.lastIndexOf('article'));
	const declaration = document.positionAt(source.indexOf('const article') + 6);
	expect(body).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ start: { line: declaration.line + 1, offset: declaration.character + 1 } }),
		]),
	);
	const rename = await request('rename', source, source.lastIndexOf('article'), {
		findInStrings: false,
		findInComments: false,
	});
	expect(rename.body.info.canRename).toBe(true);
	expect(rename.body.locs.flatMap((loc: { locs: unknown[] }) => loc.locs)).toHaveLength(5);
});

test('editor diagnostics enforce exhaustive coverage by default and refresh after edits', async () => {
	const missing = source.replace(`<p v-when="{ kind: 'error', const error }">{{ error.message }}</p>`, '');
	const diagnostics = await request('semanticDiagnosticsSync', missing);
	expect(diagnostics.body).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ code: 2322, text: expect.stringContaining('Non-exhaustive v-match') }),
		]),
	);
	await (await getLanguageServer()).close(uri);
	const complete = await request('semanticDiagnosticsSync', source);
	expect(complete.body).toEqual([]);
});

test('type-aware unreachable arms warn without becoming vue-tsc errors', async () => {
	const text = `<script setup lang="ts">defineProps<{ status: 'a' | 'b' }>();</script>
<template><template v-match="status"><i v-when="'a'"/><i v-when="'a'"/><i v-when="'c'"/><i v-when="'b'"/></template></template>`;
	const server = await getLanguageServer();
	await server.open(uri, 'vue', text);
	const result = await server.tsserver.message({
		seq: server.nextSeq(),
		type: 'request',
		command: '_vue:getMatchWarnings',
		arguments: [URI.parse(uri).fsPath],
	});
	expect(result.success).toBe(true);
	expect(result.body).toHaveLength(2);
	expect(result.body.map((warning: { message: string }) => warning.message)).toEqual([
		'Unreachable v-when: this pattern cannot match any remaining value.',
		'Unreachable v-when: this pattern cannot match any remaining value.',
	]);
});

test('definition and rename distinguish shadowed bindings', async () => {
	const text = `<script setup lang="ts">
const value = 'setup';
defineProps<{ rows: { value: string }[] }>();
</script><template>
<div v-for="value in rows"><template v-match="value">
<button v-when="{ const value } if (value.length)" :title="value" @click="value.toUpperCase()">
<b v-for="value in value">{{ value.toLowerCase() }}</b>{{ value }}
</button><i v-when="const value">{{ value.value }}</i>
</template></div><footer>{{ value }}</footer>
</template>`;
	const armDeclaration = text.indexOf('{ const value') + '{ const '.length;
	const armReference = text.indexOf('value.toUpperCase');
	const { body, document } = await request('definition', text, armReference);
	const position = document.positionAt(armDeclaration);
	expect(body).toEqual([
		expect.objectContaining({ start: { line: position.line + 1, offset: position.character + 1 } }),
	]);
	const rename = await request('rename', text, armReference, { findInStrings: false, findInComments: false });
	const offsets = rename.body.locs.flatMap((file: { locs: { start: { line: number; offset: number } }[] }) =>
		file.locs.map(loc => document.offsetAt({ line: loc.start.line - 1, character: loc.start.offset - 1 }))
	);
	expect(offsets.sort((a: number, b: number) => a - b)).toEqual([
		armDeclaration,
		text.indexOf('value.length'),
		text.indexOf(':title="value"') + ':title="'.length,
		armReference,
		text.indexOf('in value') + 'in '.length,
		text.indexOf('</b>{{ value') + '</b>{{ '.length,
	]);
	const inner = await request('quickinfo', text, text.indexOf('value.toLowerCase'));
	expect(inner.body.displayString).toBe('const value: string');
	const diagnostics = await request('semanticDiagnosticsSync', text);
	expect(diagnostics.body).toEqual([]);
});

test('editor rejects repeated names within one pattern', async () => {
	const text = `<script setup lang="ts">defineProps<{ result: unknown }>();</script>
<template><template v-match="result"><i v-when="{ const value, ...const value }"/><i v-when="_"/></template></template>`;
	const { body } = await request('semanticDiagnosticsSync', text);
	expect(body).toEqual([
		expect.objectContaining({ text: expect.stringContaining('Duplicate pattern binding value') }),
	]);
});

test.each(['', ' lang="html"'])('SFC root header supports navigation and completion (%s)', async lang => {
	const text = source.replace('<template><template v-match', `<template${lang} v-match`).replace(
		'</template></template>',
		'</template>',
	);
	const offset = text.indexOf('v-match="result"') + 'v-match="'.length;
	const { body } = await request('quickinfo', text, offset);
	expect(body.displayString).toContain('result:');
	const definition = await request('definition', text, offset);
	const position = definition.document.positionAt(text.indexOf('result:'));
	expect(definition.body).toEqual([
		expect.objectContaining({ start: { line: position.line + 1, offset: position.character + 1 } }),
	]);
	const rename = await request('rename', text, offset, { findInStrings: false, findInComments: false });
	expect(rename.body.info.canRename).toBe(true);
	expect(rename.body.locs.flatMap((file: { locs: unknown[] }) => file.locs)).toHaveLength(2);
	const completions = await request('completionInfo', text, offset + 3);
	expect(completions.body.entries.map((entry: { name: string }) => entry.name)).toContain('result');
	const binding = await request('quickinfo', text, text.indexOf('article.length'));
	expect(binding.body.displayString).toBe('const article: string');
	expect((await request('semanticDiagnosticsSync', text)).body).toEqual([]);
});

test('header-only edits refresh coverage and diagnostic locations', async () => {
	const text = `<script setup lang="ts">defineProps<{ a: 'a'; b: 'a' | 'b' }>();</script>
<template v-match="a"><p v-when="'a'"/></template>`;
	expect((await request('semanticDiagnosticsSync', text)).body).toEqual([]);
	for (
		const edited of [text.replace('v-match="a"', 'v-match="b"'), text.replace('v-match="a"', 'lang="html" v-match="b"')]
	) {
		const { body, document } = await request('semanticDiagnosticsSync', edited);
		const position = document.positionAt(edited.indexOf('v-match="b"') + 'v-match="'.length);
		expect(body).toEqual([
			expect.objectContaining({
				text: expect.stringContaining('Non-exhaustive v-match'),
				start: { line: position.line + 1, offset: position.character + 1 },
			}),
		]);
	}
	expect((await request('semanticDiagnosticsSync', text)).body).toEqual([]);
});
