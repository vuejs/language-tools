import * as path from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { LspDocument, type LspServer, startLspServer } from './lsp';
import { repositoryRoot } from './utils';

const workspace = path.join(repositoryRoot, 'test-workspace/content-mapper-lsp');
const shorthand = new LspDocument(path.join(workspace, 'Shorthand.vue'));
const cssModule = new LspDocument(path.join(workspace, 'CssModule.vue'));
const cssModuleSrc = new LspDocument(path.join(workspace, 'CssModuleSrc.vue'));
const runtimeProps = new LspDocument(path.join(workspace, 'RuntimeProps.vue'));
const typeProps = new LspDocument(path.join(workspace, 'TypeProps.vue'));
const propsParent = new LspDocument(path.join(workspace, 'PropsParent.vue'));
const model = new LspDocument(path.join(workspace, 'Model.vue'));
const modelParent = new LspDocument(path.join(workspace, 'ModelParent.vue'));
const tagHighlights = new LspDocument(path.join(workspace, 'TagHighlights.vue'));
const semanticTokens = new LspDocument(path.join(workspace, 'SemanticTokens.vue'));
const eventProps = new LspDocument(path.join(workspace, 'EventProps.vue'));
const eventPropsParent = new LspDocument(path.join(workspace, 'EventPropsParent.vue'));
const modelKebab = new LspDocument(path.join(workspace, 'ModelKebab.vue'));
const modelKebabParent = new LspDocument(path.join(workspace, 'ModelKebabParent.vue'));
const localDirective = new LspDocument(path.join(workspace, 'LocalDirective.vue'));
const typeEmits = new LspDocument(path.join(workspace, 'TypeEmits.vue'));
const emitsParent = new LspDocument(path.join(workspace, 'EmitsParent.vue'));
const styleClassNames = new LspDocument(path.join(workspace, 'StyleClassNames.vue'));
const documents = [
	shorthand,
	cssModule,
	styleClassNames,
	cssModuleSrc,
	runtimeProps,
	typeProps,
	propsParent,
	model,
	modelParent,
	tagHighlights,
	semanticTokens,
	eventProps,
	eventPropsParent,
	modelKebab,
	modelKebabParent,
	localDirective,
	typeEmits,
	emitsParent,
];

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

test('tag names highlight like any other reference to the component or element', async () => {
	const component = ['1:7 TypeProps', '7:15 TypeProps', '7:3 TypeProps', '9:2 TypeProps'];
	expect(await highlights(tagHighlights, tagHighlights.at('import TypeProps', 0, 7))).toEqual(component);
	expect(await highlights(tagHighlights, tagHighlights.at('<TypeProps />', 0, 1))).toEqual(component);
	expect(await highlights(tagHighlights, tagHighlights.at('</TypeProps>', 0, 2))).toEqual(component);
	expect(await highlights(tagHighlights, tagHighlights.at('<div>', 0, 1))).toEqual([
		'10:2 div',
		'10:21 div',
		'6:2 div',
		'8:3 div',
	]);
	expect(await highlights(tagHighlights, tagHighlights.at('const msg', 0, 6))).toEqual(['10:14 msg', '2:6 msg']);
});

test('semantic tokens come from script and interpolation identifiers only, not template names', async () => {
	const { tokenTypes, tokenModifiers } = server.capabilities.semanticTokensProvider.legend;
	const { data }: { data: number[] } = await server.request('textDocument/semanticTokens/full', {
		textDocument: { uri: semanticTokens.uri },
	});
	const tokens: string[] = [];
	let line = 0;
	let character = 0;
	for (let i = 0; i < data.length; i += 5) {
		line += data[i]!;
		character = data[i] ? data[i + 1]! : character + data[i + 1]!;
		const modifiers = tokenModifiers.filter((_: string, bit: number) => data[i + 4]! & (1 << bit));
		tokens.push(
			semanticTokens.describe({ start: { line, character }, end: { line, character: character + data[i + 2]! } })
				+ ` ${[tokenTypes[data[i + 3]!], ...modifiers].join('.')}`,
		);
	}
	// Native tag names, attribute and prop names, directive modifiers, slot names and the `:is`
	// shorthand get none, though TypeScript would type their generated code as properties, methods or classes.
	expect(tokens).toEqual([
		'2:6 vFocus variable.declaration.readonly',
		'2:17 mounted method.declaration',
		'3:6 msg variable.declaration.readonly',
		'4:6 is class.declaration',
		'8:21 msg variable.readonly',
		'8:53 msg variable.readonly',
		'11:22 msg variable.readonly',
		'12:24 item variable.declaration.readonly',
		'12:35 item variable.readonly',
	]);
});

test('rename leaves template shorthands untouched instead of corrupting them', async () => {
	expect(await rename(shorthand, shorthand.at('{ fooBar: number', 0, 2))).toEqual(['10:31 fooBar -> NEW']);
	expect(await rename(shorthand, shorthand.at('const fooBar', 0, 6))).toEqual(['8:6 fooBar -> NEW']);
	expect(await rename(shorthand, shorthand.at('const foo ', 0, 6))).toEqual(['9:6 foo -> NEW']);
});

test('renaming a default import does not insert text at the top of the imported SFC', async () => {
	const position = tagHighlights.at('import TypeProps', 0, 7);
	// the synthetic `export default` of TypeProps.vue maps to its top, and references reach it
	expect(await references(tagHighlights, position)).toContain('TypeProps:0:0 ');
	expect(await rename(tagHighlights, position)).toEqual([
		'1:7 TypeProps -> NEW',
		'7:15 TypeProps -> NEW',
		'7:3 TypeProps -> NEW',
		'9:2 TypeProps -> NEW',
	]);
});

test('CSS module classes rename from either side', async () => {
	const expected = ['1:21 foo -> NEW', '5:1 foo -> NEW'];
	expect(await rename(cssModule, cssModule.at('$style.foo', 0, 7))).toEqual(expected);
	expect(await rename(cssModule, cssModule.at('.foo', 0, 1))).toEqual(expected);
	expect(await definition(cssModule, cssModule.at('$style.foo', 0, 7))).toEqual(['5:1 foo']);
});

test.each([
	['scoped', 'class="scoped-name', 7, '.scoped-name', ['1:13 scoped-name', '5:1 scoped-name']],
	['CSS module', `$style['module-name`, 8, '.module-name', ['1:42 module-name', '9:1 module-name']],
])(
	'%s class names that are not identifiers link the template and the style block',
	async (_, use, offset, rule, [template, style]) => {
		const fromTemplate = styleClassNames.at(use, 0, offset);
		const fromStyle = styleClassNames.at(rule, 0, 1);
		const renamed = [`${template} -> NEW`, `${style} -> NEW`];
		expect(await rename(styleClassNames, fromTemplate)).toEqual(renamed);
		expect(await rename(styleClassNames, fromStyle)).toEqual(renamed);
		expect(await references(styleClassNames, fromStyle)).toEqual([template, style]);
		expect(await definition(styleClassNames, fromTemplate)).toEqual([style]);
	},
);

test('<style module src> imports the src, which types $style', async () => {
	const definitionFiles = async (position: ReturnType<LspDocument['at']>) => {
		const locations: any[] = await server.request('textDocument/definition', {
			textDocument: { uri: cssModuleSrc.uri },
			position,
		}) ?? [];
		return locations.map(location => {
			const uri: string = location.uri ?? location.targetUri;
			const { start } = location.range ?? location.targetSelectionRange;
			return `${decodeURIComponent(uri).split('/').pop()} ${start.line}:${start.character}`;
		});
	};
	expect(await definitionFiles(cssModuleSrc.at('./CssModuleSrc.module.css', 0, 2))).toEqual([
		'CssModuleSrc.module.d.css.ts 0:0',
	]);
	expect(await definitionFiles(cssModuleSrc.at('$style.a', 0, 7))).toEqual(['CssModuleSrc.module.d.css.ts 1:1']);
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

test('event props link the declaration and the parent listeners', async () => {
	const usages = ['1:14 onFooBar', 'EventPropsParent:1:14 foo-bar', 'EventPropsParent:2:14 fooBar'];
	expect(await references(eventProps, eventProps.at('onFooBar'))).toEqual(usages);
	expect(await references(eventPropsParent, eventPropsParent.at('@foo-bar', 0, 1))).toEqual([
		'1:14 foo-bar',
		'2:14 fooBar',
		'EventProps:1:14 onFooBar',
	]);
	expect(await definition(eventPropsParent, eventPropsParent.at('@fooBar', 0, 1))).toEqual([
		'EventProps:1:14 onFooBar',
	]);
});

test('type-based defineEmits link the declaration and the parent listeners', async () => {
	expect(await references(typeEmits, typeEmits.at('fooBar'))).toEqual([
		'1:14 fooBar',
		'EmitsParent:1:13 foo-bar',
		'EmitsParent:2:13 fooBar',
	]);
	expect(await references(emitsParent, emitsParent.at('@foo-bar', 0, 1))).toEqual([
		'1:13 foo-bar',
		'2:13 fooBar',
		'TypeEmits:1:14 fooBar',
	]);
	// the listener key also defines itself: a key-remapping mapped type links no declaration to it
	expect(await definition(emitsParent, emitsParent.at('@foo-bar', 0, 1))).toEqual([
		'1:13 foo-bar',
		'TypeEmits:1:14 fooBar',
	]);
	expect(await definition(emitsParent, emitsParent.at('@fooBar', 0, 1))).toEqual([
		'2:13 fooBar',
		'TypeEmits:1:14 fooBar',
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

test('kebab-case defineModel names link to the parent v-model arguments', async () => {
	const usages = ['1:21 foo-bar', '2:21 fooBar', "ModelKebab:1:35 'foo-bar'"];
	expect(await references(modelKebabParent, modelKebabParent.at(':fooBar', 0, 1))).toEqual(usages);
	expect(await references(modelKebab, modelKebab.at("'foo-bar'", 0, 1))).toEqual([
		"1:35 'foo-bar'",
		'ModelKebabParent:1:21 foo-bar',
		'ModelKebabParent:2:21 fooBar',
	]);
	expect(await definition(modelKebabParent, modelKebabParent.at(':foo-bar', 0, 1))).toEqual([
		"ModelKebab:1:35 'foo-bar'",
	]);
	expect(await definition(modelKebabParent, modelKebabParent.at(':fooBar', 0, 1))).toEqual([
		"ModelKebab:1:35 'foo-bar'",
	]);
});

test('local directives link the setup binding and the template usages', async () => {
	const usages = ['1:6 v-my-dir', '5:6 vMyDir'];
	expect(await references(localDirective, localDirective.at('vMyDir'))).toEqual(usages);
	expect(await references(localDirective, localDirective.at('v-my-dir'))).toEqual(usages);
	expect(await definition(localDirective, localDirective.at('v-my-dir'))).toEqual(['5:6 vMyDir']);
});
