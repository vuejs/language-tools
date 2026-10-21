import * as path from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { LspDocument, type LspServer, startLspServer } from './lsp';
import { repositoryRoot } from './utils';

const workspace = path.join(repositoryRoot, 'test-workspace/content-mapper-lsp');
const shorthand = new LspDocument(path.join(workspace, 'Shorthand.vue'));
const cssModule = new LspDocument(path.join(workspace, 'CssModule.vue'));
const runtimeProps = new LspDocument(path.join(workspace, 'RuntimeProps.vue'));
const typeProps = new LspDocument(path.join(workspace, 'TypeProps.vue'));
const propsParent = new LspDocument(path.join(workspace, 'PropsParent.vue'));
const model = new LspDocument(path.join(workspace, 'Model.vue'));
const modelParent = new LspDocument(path.join(workspace, 'ModelParent.vue'));
const documents = [shorthand, cssModule, runtimeProps, typeProps, propsParent, model, modelParent];

let server: LspServer;

beforeAll(async () => {
	server = await startLspServer(workspace);
	for (const doc of documents) {
		doc.open(server);
	}
});

afterAll(() => server?.close());

/** Locations in workspace documents; those in another document than `doc` are prefixed with its name. */
function describe(doc: LspDocument, uri: string, range: any) {
	const target = documents.find(document => document.is(uri));
	if (!target) {
		return [];
	}
	return [target === doc ? doc.describe(range) : `${path.basename(target.fileName, '.vue')}:${target.describe(range)}`];
}

async function references(doc: LspDocument, position: ReturnType<LspDocument['at']>) {
	const locations: { uri: string; range: any }[] = await server.request('textDocument/references', {
		textDocument: { uri: doc.uri },
		position,
		context: { includeDeclaration: true },
	}) ?? [];
	return locations.flatMap(location => describe(doc, location.uri, location.range)).sort();
}

async function definition(doc: LspDocument, position: ReturnType<LspDocument['at']>) {
	const locations: any[] = await server.request('textDocument/definition', { textDocument: { uri: doc.uri }, position })
		?? [];
	return locations
		.flatMap(location =>
			describe(doc, location.uri ?? location.targetUri, location.range ?? location.targetSelectionRange)
		)
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
	return Object.entries(result?.changes ?? {})
		.flatMap(([uri, edits]) =>
			edits.flatMap(edit => describe(doc, uri, edit.range).map(text => `${text} -> ${edit.newText}`))
		)
		.sort();
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

test('runtime props link the declaration and the parent usages like type-based props', async () => {
	expect(await references(typeProps, typeProps.at('aaaBbb'))).toEqual([
		'1:14 aaaBbb',
		'PropsParent:3:13 aaa-bbb',
		'PropsParent:4:13 aaaBbb',
	]);
	expect(await references(runtimeProps, runtimeProps.at('aaaBbb'))).toEqual([
		'1:14 aaaBbb',
		'PropsParent:1:16 aaa-bbb',
		'PropsParent:2:16 aaaBbb',
	]);
	expect(await references(propsParent, propsParent.at(':aaaBbb', 0, 1))).toEqual([
		'1:16 aaa-bbb',
		'2:16 aaaBbb',
		'RuntimeProps:1:14 aaaBbb',
	]);
	expect(await definition(propsParent, propsParent.at(':aaa-bbb', 0, 1))).toEqual(['RuntimeProps:1:14 aaaBbb']);
	expect(await definition(propsParent, propsParent.at(':aaaBbb', 0, 1))).toEqual(['RuntimeProps:1:14 aaaBbb']);
	// The kebab-case usage is an atom (renaming it would need a case conversion), so it is left out.
	expect(await rename(typeProps, typeProps.at('aaaBbb'))).toEqual([
		'1:14 aaaBbb -> NEW',
		'PropsParent:4:13 aaaBbb -> NEW',
	]);
	expect(await rename(runtimeProps, runtimeProps.at('aaaBbb'))).toEqual([
		'1:14 aaaBbb -> NEW',
		'PropsParent:2:16 aaaBbb -> NEW',
	]);
});

test('defineModel names link to the parent v-model arguments', async () => {
	const usages = ['1:16 fooBar', '2:16 foo-bar', 'Model:1:36 fooBar'];
	expect(await references(modelParent, modelParent.at(':fooBar', 0, 1))).toEqual(usages);
	expect(await references(model, model.at("'fooBar'", 0, 1))).toEqual([
		'1:36 fooBar',
		'ModelParent:1:16 fooBar',
		'ModelParent:2:16 foo-bar',
	]);
	expect(await definition(modelParent, modelParent.at(':fooBar', 0, 1))).toEqual(["Model:1:35 'fooBar'"]);
	expect(await definition(modelParent, modelParent.at(':foo-bar', 0, 1))).toEqual(["Model:1:35 'fooBar'"]);
	expect(await rename(modelParent, modelParent.at(':fooBar', 0, 1))).toEqual([
		'1:16 fooBar -> NEW',
		'Model:1:36 fooBar -> NEW',
	]);
	// The default model prop is synthesized as `modelValue` with no source token to map back to.
	expect(await definition(modelParent, modelParent.at('v-model=', 0, 2))).toEqual([]);
});
