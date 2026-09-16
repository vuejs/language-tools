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
