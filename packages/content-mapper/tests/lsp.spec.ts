import * as path from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { LspDocument, type LspServer, startLspServer } from './lsp';
import { repositoryRoot } from './utils';

const workspace = path.join(repositoryRoot, 'test-workspace/content-mapper-lsp');
const shorthand = new LspDocument(path.join(workspace, 'Shorthand.vue'));
const cssModule = new LspDocument(path.join(workspace, 'CssModule.vue'));

let server: LspServer;

beforeAll(async () => {
	server = await startLspServer(workspace);
	shorthand.open(server);
	cssModule.open(server);
});

afterAll(() => server?.close());

async function references(doc: LspDocument, position: ReturnType<LspDocument['at']>) {
	const locations: { uri: string; range: any }[] = await server.request('textDocument/references', {
		textDocument: { uri: doc.uri },
		position,
		context: { includeDeclaration: true },
	}) ?? [];
	return locations.filter(location => location.uri === doc.uri).map(location => doc.describe(location.range)).sort();
}

async function definition(doc: LspDocument, position: ReturnType<LspDocument['at']>) {
	const locations: any[] = await server.request('textDocument/definition', { textDocument: { uri: doc.uri }, position })
		?? [];
	return locations
		.filter(location => (location.uri ?? location.targetUri) === doc.uri)
		.map(location => doc.describe(location.range ?? location.targetSelectionRange))
		.sort();
}

async function highlights(doc: LspDocument, position: ReturnType<LspDocument['at']>) {
	const result: { range: any }[] = await server.request('textDocument/documentHighlight', {
		textDocument: { uri: doc.uri },
		position,
	}) ?? [];
	return result.map(highlight => doc.describe(highlight.range)).sort();
}

async function rename(doc: LspDocument, position: ReturnType<LspDocument['at']>) {
	const result: { changes?: Record<string, { range: any; newText: string }[]> } | null = await server.request(
		'textDocument/rename',
		{ textDocument: { uri: doc.uri }, position, newName: 'NEW' },
	);
	return (result?.changes?.[doc.uri] ?? []).map(edit => `${doc.describe(edit.range)} -> ${edit.newText}`).sort();
}

test('same-name v-bind shorthand links the template and the script variable', async () => {
	const variable = shorthand.at('const fooBar', 0, 6);
	const kebab = shorthand.at(':foo-bar', 0, 1);

	expect(await references(shorthand, variable)).toEqual([
		'1:8 foo-bar',
		'2:8 fooBar',
		'4:15 fooBar',
		'8:6 fooBar',
	]);
	expect(await references(shorthand, kebab)).toContain('8:6 fooBar');
	expect(await definition(shorthand, kebab)).toContain('8:6 fooBar');
	expect(await definition(shorthand, shorthand.at(':fooBar', 0, 1))).toContain('8:6 fooBar');
});

test('object shorthand in interpolations links the template and the script variable', async () => {
	const variable = shorthand.at('const foo ', 0, 6);

	expect(await references(shorthand, variable)).toEqual(['3:6 foo', '9:6 foo']);
	expect(await highlights(shorthand, variable)).toEqual(['3:6 foo', '9:6 foo']);
	expect(await definition(shorthand, shorthand.at('{ foo }', 0, 2))).toContain('9:6 foo');
});

test('rename leaves template shorthands untouched instead of corrupting them', async () => {
	expect(await rename(shorthand, shorthand.at('{ fooBar: number', 0, 2))).toEqual(['10:31 fooBar -> NEW']);
	expect(await rename(shorthand, shorthand.at('const fooBar', 0, 6))).toEqual(['8:6 fooBar -> NEW']);
	expect(await rename(shorthand, shorthand.at('const foo ', 0, 6))).toEqual(['9:6 foo -> NEW']);
});

test('CSS module classes rename from either side', async () => {
	const expected = ['1:21 foo -> NEW', '5:1 foo -> NEW'];
	expect(await rename(cssModule, cssModule.at('$style.foo', 0, 7))).toEqual(expected);
	expect(await rename(cssModule, cssModule.at('.foo', 0, 1))).toEqual(expected);
	expect(await definition(cssModule, cssModule.at('$style.foo', 0, 7))).toEqual(['5:1 foo']);
});
