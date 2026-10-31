import { SpanMapKind } from '@volar/language-core';
import {
	codeToString,
	getDefaultCompilerOptions,
	type IRScript,
	type IRScriptSetup,
	resolveCodeOffsets,
	scriptFeatures,
} from '@vue/language-core';
import { loadTypeScript } from '@vue/language-core/typescript';
import type * as ts from 'typescript/ast' with { 'resolution-mode': 'import' };
import { expect, test } from 'vitest';
import { useServiceScript } from '../lib/codegen';
import {
	type CodegenPlugin,
	loadCodegenPlugins,
	PluginSlice,
	type VueCodegenFile,
	type VueCodegenFilePlugin,
	type VueCodegenPlugin,
	type VueCodegenSlice,
	type VueCodegenWriter,
} from '../lib/codegen/plugin';
import { createSnapshot, createSource, generate } from './utils';

/** The plugin of `codegen`, loaded as the `codegen` export of an entry `name`. */
function plugin(codegen: VueCodegenPlugin, name = 'test-plugin'): CodegenPlugin {
	const { plugins: [loaded] } = loadCodegenPlugins({ plugins: [{ name, config: {}, module: { codegen } }] } as never);
	return loaded!;
}

/** A plugin that rewrites the `<script setup>` of the file. */
function rewriteSetup(
	rewrite: (writer: VueCodegenWriter, block: IRScriptSetup, file: VueCodegenFile) => void,
	name?: string,
): CodegenPlugin {
	return plugin(file => ({ rewrite: ({ scriptSetup }) => rewrite(scriptSetup!, file.ir.scriptSetup!, file) }), name);
}

function generateWith(content: string, ...plugins: CodegenPlugin[]) {
	const result = generate('/Comp.vue', content, undefined, plugins);
	for (const { virtualStart, virtualEnd, originalStart, originalEnd, kind } of result.mappings) {
		if (kind === SpanMapKind.Verbatim) {
			expect(result.text.slice(virtualStart, virtualEnd)).toBe(content.slice(originalStart, originalEnd));
		}
	}
	return result;
}

function rangeOf(block: IRScript | IRScriptSetup, text: string) {
	const start = block.content.indexOf(text);
	expect(start).toBeGreaterThanOrEqual(0);
	return { start, end: start + text.length };
}

/** The outermost node of the AST of `block` whose text, from its start without trivia, is `text`. */
function nodeAt(block: IRScript | IRScriptSetup, text: string) {
	const { start, end } = rangeOf(block, text);
	const find = (node: ts.Node): ts.Node | undefined =>
		node.getStart(block.ast) === start && node.end === end ? node : node.forEachChild(find);
	const node = block.ast.forEachChild(find);
	expect(node).toBeDefined();
	return node!;
}

test('applies the rewrites of plugins, mapping the source ranges that they keep', () => {
	const content = `<script setup lang="ts">\nconst a = useFoo();\n</script>\n`;
	const { text, mappings } = generateWith(
		content,
		rewriteSetup((writer, block) => {
			const call = rangeOf(block, 'useFoo()');
			writer.insertBefore(call.start, 'wrap(');
			writer.insertAfter(call.end, ')');
			writer.insertAfter(call.end, ' as X');
		}),
	);
	expect(text).toContain('const a = wrap(useFoo()) as X;');
	const copied = text.indexOf('useFoo()');
	expect(
		mappings.some(({ virtualStart, originalStart }) =>
			virtualStart === copied && originalStart === content.indexOf('useFoo()')
		),
	).toBe(true);
	const inserted = text.indexOf(' as X');
	expect(
		mappings.some(({ virtualStart, virtualEnd }) => virtualStart <= inserted && inserted < virtualEnd),
	).toBe(false);
});

test('rejects an edit of a plugin that is not valid for its block', () => {
	const content = `<script setup lang="ts">\nconst a = useFoo();\n</script>\n`;
	const edits: ((writer: VueCodegenWriter, block: IRScriptSetup, file: VueCodegenFile) => void)[] = [
		(writer, block) => writer.insertBefore(block.content.length + 1, 'x'),
		(writer, block) => writer.replace(0, block.content.length + 1, ''),
		writer => writer.replace(1, 1, ''),
		writer => writer.insertBefore(0, [{ text: 'x' }] as never),
		(writer, block) => writer.insertBefore(0, { source: block, start: 0, end: 1, data: {} } as never),
		(writer, block) => writer.cut(nodeAt(block, 'useFoo'), {} as never),
		(writer, block) => writer.cut(nodeAt(block, 'useFoo'), { data: { features: 0.5 } }),
		(writer, block) => writer.cut(nodeAt(block, 'useFoo'), { data: { features: 0 } }).render(() => {}),
		writer => writer.cut({ start: 0, end: 1 } as never, { data: { features: 0 } }),
		(writer, block) => writer.cut(block.ast, { data: { features: 0 } }),
		(writer, block, { ts }) =>
			writer.cut(ts.createSourceFile('/a.ts', block.content, 99).statements[0]!, { data: { features: 0 } }),
		writer => writer.insertBefore(0, { render() {} }),
	];
	for (const edit of edits) {
		expect(() => generateWith(content, rewriteSetup(edit))).toThrow(`'test-plugin'`);
	}
	// the initializer that the parser gives for the missing expression, which has no char
	const missing = (writer: VueCodegenWriter, block: IRScriptSetup) => {
		const [statement] = block.ast.statements as readonly ts.Node[] as readonly ts.VariableStatement[];
		writer.cut(statement!.declarationList.declarations[0]!.initializer!, { data: { features: 0 } });
	};
	expect(() => generateWith(`<script setup lang="ts">\nconst a = ;\n</script>\n`, rewriteSetup(missing)))
		.toThrow(`'test-plugin'`);
});

test('exports what the plugins set, and rejects exports that are not valid', () => {
	const content = `<script setup lang="ts">\n/** Doc. */\nconst a = 1;\n</script>\n`;
	const { text } = generateWith(
		content,
		plugin(({ ir }) => ({
			exports: () => ({
				names: ['Foo'],
				docComment: { block: ir.scriptSetup!, ...rangeOf(ir.scriptSetup!, '/** Doc. */') },
			}),
		})),
	);
	expect(text).toContain('/** Doc. */\nconst Foo = ');
	const invalid: ((file: VueCodegenFile) => unknown)[] = [
		() => 1,
		() => ({ exports: 1 }),
		() => ({ generate: () => ({}) }),
		() => ({ exports: () => 1 }),
		() => ({ exports: () => ({ names: ['not a name'] }) }),
		() => ({ exports: () => ({ names: 'Foo' }) }),
		() => ({ exports: () => ({ default: 'no' }) }),
		() => ({ declarations: () => 'declare const x: 1' }),
		() => ({ componentOptions: () => [{ text: 'x' }] }),
		() => ({ fallthroughProps: () => [['x']] }),
		() => ({ props: () => [['{ a?: 1 }']] }),
		() => ({ props: () => [{ defaults: 'D' }] }),
		() => ({ props: () => [{ type: ['{ a?: 1 }'], local: 'L' }] }),
		() => ({ props: () => [{ runtime: '{}', local: ['L'] }] }),
		() => ({ emits: () => [['{ a: [] }']] }),
		() => ({ emits: () => [{}] }),
		() => ({ emits: () => [{ type: ['{ a: [] }'], emit: 'E' }] }),
		() => ({ emits: () => [{ emit: ['E'] }] }),
		({ ir }) => ({
			exports: () => ({ docComment: { block: ir.scriptSetup!, ...rangeOf(ir.scriptSetup!, 'const a') } }),
		}),
		({ ir }) => ({ exports: () => ({ docComment: { block: ir.scriptSetup!, start: 0, end: 1000 } }) }),
	];
	for (const codegen of invalid) {
		expect(() => generateWith(content, plugin(codegen as never))).toThrow(`'test-plugin'`);
	}
});

test('inserts the pieces of a plugin, mapped to their ranges', () => {
	const content = `<script setup lang="ts">\nconst a = useFoo();\n</script>\n`;
	const { text, mappings } = generateWith(
		content,
		rewriteSetup((writer, block) => {
			const call = rangeOf(block, 'useFoo');
			writer.insertBefore(call.start, [
				'wrap(',
				{ source: block, ...call, data: { features: scriptFeatures } },
				') || ',
			]);
		}),
	);
	expect(text).toContain('const a = wrap(useFoo) || useFoo();');
	const copied = text.indexOf('wrap(') + 'wrap('.length;
	expect(mappings).toContainEqual(expect.objectContaining({
		virtualStart: copied,
		virtualEnd: copied + 'useFoo'.length,
		originalStart: content.indexOf('useFoo'),
		kind: SpanMapKind.Verbatim,
	}));
});

test('moves the code that a plugin cuts to where it inserts the cut, with the edits in it', () => {
	const content = `<script setup lang="ts">\nconst a = useFoo();\nconst b = 1;\n</script>\n`;
	const { text, mappings } = generateWith(
		content,
		rewriteSetup((writer, block) => {
			const call = rangeOf(block, 'useFoo');
			writer.insertBefore(call.start, 'wrap.');
			const cut = writer.cut(nodeAt(block, 'const a = useFoo();'), { data: { features: scriptFeatures } });
			writer.insertAfter(block.content.length, ['/* moved */ ', cut]);
			const b = rangeOf(block, 'b');
			writer.replace(b.start, b.end, '');
		}),
	);
	expect(text).toContain('/* moved */ const a = wrap.useFoo();');
	expect(text).not.toContain('const b');
	expect(text.indexOf(' = 1;')).toBeLessThan(text.indexOf('/* moved */'));
	const moved = text.indexOf('/* moved */ ') + '/* moved */ '.length;
	expect(mappings).toContainEqual(expect.objectContaining({
		virtualStart: moved,
		originalStart: content.indexOf('const a'),
		kind: SpanMapKind.Verbatim,
	}));
});

test('throws for a node that a plugin cuts and places nowhere, as replace removes code', () => {
	const content = `<script setup lang="ts">\nconst a = 1;\n</script>\n`;
	expect(() =>
		generateWith(content, rewriteSetup((writer, block) => {
			writer.cut(nodeAt(block, 'a'), { data: { features: scriptFeatures } });
		}))
	).toThrow(`The codegen plugin 'test-plugin' cut a node that the generated code places nowhere`);
});

/** A plugin that moves the type argument of `defineProp<T>('foo')` into the props, with the edits of `edit` in it. */
function moveTypeArgument(edit?: (writer: VueCodegenWriter, block: IRScriptSetup) => void, onRewrite?: () => void) {
	return plugin(({ ir }) => {
		let type: VueCodegenSlice | undefined;
		return {
			rewrite({ scriptSetup }) {
				onRewrite?.();
				const block = ir.scriptSetup!;
				edit?.(scriptSetup!, block);
				type = scriptSetup!.cut(nodeAt(block, 'string'), { data: { features: scriptFeatures }, placeholder: 'any' });
			},
			props: () => [{ type: ['{ foo: ', type!, ' }'] }],
		};
	});
}

test('moves the code that a plugin cuts into a slot, with the edits in it', () => {
	const content = `<script setup lang="ts">\nconst foo = defineProp<string>('foo');\n</script>\n`;
	const { text, mappings } = generateWith(
		content,
		moveTypeArgument((writer, block) => writer.insertBefore(rangeOf(block, 'string').start, 'Lowercase<'), undefined),
		rewriteSetup((writer, block) => writer.insertAfter(rangeOf(block, 'string').end, '>')),
	);
	expect(text).toContain(`const foo = defineProp<any>('foo');`);
	expect(text).toContain('{ foo: Lowercase<string> }');
	expect(mappings).toContainEqual(expect.objectContaining({
		virtualStart: text.indexOf('string>'),
		originalStart: content.indexOf('string'),
		kind: SpanMapKind.Verbatim,
	}));
	for (
		const slot of [
			() => ({ props: () => [{ type: new PluginSlice('test-plugin', { features: 0 }) }] }),
			() => ({ props: () => [{ type: { render() {} } }] as never }),
		]
	) {
		expect(() => generateWith(content, plugin(slot))).toThrow(`'test-plugin'`);
	}
});

test('places the code of each slot of a plugin once, so that a slice in it renders, and throws for a slot that the shape has no place for', () => {
	const setup = `const a = 1; [/* moved */];\n`;
	const contents = [
		`<script setup lang="ts">\n${setup}</script>\n<template><div>{{ $attrs }}</div></template>\n`,
		`<script setup lang="ts" generic="U">\n${setup}</script>\n<template><div>{{ $attrs }}</div></template>\n`,
		`<script lang="ts">\nexport default {};\n</script>\n<script setup lang="ts">\n${setup}</script>\n`
		+ `<template><div>{{ $attrs }}</div></template>\n`,
	];
	const slots: ((file: VueCodegenFile, moved: () => VueCodegenSlice) => VueCodegenFilePlugin)[] = [
		(_, moved) => ({ templateContext: () => [['{ a: 1 }', moved()]] }),
		(_, moved) => ({ templateBody: () => [moved()] }),
		(file, moved) => {
			const name = file.name('Moved');
			return { templateTypes: () => [{ name, code: ['{}', moved()] }] };
		},
		(_, moved) => ({ templateDollars: () => [['{}', moved()]] }),
		({ ir }, moved) => ({ elementEnd: () => new Map([[ir.template!.ast!.children[0] as never, [moved()]]]) }),
		(_, moved) => ({ props: () => [{ type: ['{ a?: 1 }', moved()] }] }),
		(_, moved) => ({ props: () => [{ runtime: ['{}', moved()] }] }),
		(_, moved) => ({ setupBody: () => [moved()] }),
		(_, moved) => ({ emits: () => [{ type: ['{ a: [] }', moved()] }] }),
		(_, moved) => ({ expose: () => [['{ a: 1 }', moved()]] }),
		(_, moved) => ({ generic: () => [['T', moved()]] }),
		(_, moved) => ({ elements: () => [['{ div: HTMLDivElement }', moved()]] }),
		(_, moved) => ({ declarations: () => [moved()] }),
	];
	// the slots of the component that the other shape of the component has no place for
	const shapes = new Map<(typeof slots)[number], number[]>([
		[(_, moved) => ({ componentOptions: () => [['__typeMoved: {}', moved()]] }), [0, 2]],
		[(_, moved) => ({ exposedInstanceTypes: () => [['{}', moved()]] }), [1]],
	]);
	slots.push(...shapes.keys());
	const vueCompilerOptions = { ...getDefaultCompilerOptions(), inferTemplateDollarAttrs: true };
	for (const [index, content] of contents.entries()) {
		for (const slot of slots) {
			const moving = plugin(file => {
				let moved: VueCodegenSlice | undefined;
				return {
					rewrite({ scriptSetup }) {
						moved = scriptSetup!.cut(nodeAt(file.ir.scriptSetup!, '[/* moved */]'), {
							data: { features: scriptFeatures },
						});
					},
					...slot(file, () => moved!),
				};
			});
			const placed = shapes.get(slot)?.includes(index) ?? true;
			const run = () => generate('/Comp.vue', content, vueCompilerOptions, [moving]);
			if (placed) {
				expect(run().text.split('/* moved */').length, `${slot}\n${content}`).toBe(2);
			}
			else {
				expect(run, `${slot}\n${content}`).toThrow(`'test-plugin'`);
			}
		}
	}
});

test('moves the code that a later plugin cuts around a cut of a plugin before it, with the placeholder in it', () => {
	const content = `<script setup lang="ts">\nconst foo = defineProp<string>('foo');\nconst b = 1;\n</script>\n`;
	const { text } = generateWith(
		content,
		moveTypeArgument(),
		rewriteSetup((writer, block) => {
			const statement = writer.cut(nodeAt(block, `const foo = defineProp<string>('foo');`), {
				data: { features: scriptFeatures },
			});
			writer.insertAfter(block.content.length, ['/* moved */ ', statement]);
		}),
	);
	expect(text).toContain(`/* moved */ const foo = defineProp<any>('foo');`);
	expect(text.indexOf('const b = 1;')).toBeLessThan(text.indexOf('/* moved */'));
	expect(text).toContain('{ foo: string }');
});

test('places the slices of a slot of a plugin in each rewrite of its snapshot', () => {
	const script = `<script setup lang="ts">\nconst foo = defineProp<string>('foo');\n</script>\n`;
	const source = createSource('/Comp.vue', script + `<template>{{ 1 }}</template>\n`);
	let rewrites = 0;
	const getServiceScript = useServiceScript(loadTypeScript(), source, [moveTypeArgument(undefined, () => rewrites++)]);
	const render = () => codeToString(resolveCodeOffsets(source.ir, getServiceScript().codes));
	expect(render()).toContain('{ foo: string }');
	source.update(createSnapshot(script + `<template>{{ 2 }}</template>\n`));
	const text = render();
	expect(text).toContain('{ foo: string }');
	expect(text).toContain('2');
	expect(rewrites).toBe(1);
});

test('leaves the placeholder of a cut where its chars are cut from, and maps them with its features', () => {
	const content = `<script setup lang="ts">\nconst a = useFoo('a');\n</script>\n`;
	const { text, mappings } = generateWith(
		content,
		rewriteSetup((writer, block) => {
			const call = rangeOf(block, `useFoo('a')`);
			const cut = writer.cut(nodeAt(block, `'a'`), { data: { features: 0 }, placeholder: 'any' });
			writer.insertAfter(call.end, [' as Foo[', cut, ']']);
		}),
	);
	expect(text).toContain(`const a = useFoo(any) as Foo['a'];`);
	expect(mappings).toContainEqual(expect.objectContaining({
		virtualStart: text.indexOf(`'a'`),
		originalStart: content.indexOf(`'a'`),
		features: 0,
	}));
});

test('maps a range of a plugin without text as a copy', () => {
	const content = `<script setup lang="ts">\nconst a = useFoo();\n</script>\n`;
	const { text, mappings } = generateWith(
		content,
		plugin(({ ir }) => ({
			declarations() {
				const block = ir.scriptSetup!;
				const call = rangeOf(block, 'useFoo');
				return [[
					'declare const x: typeof ',
					{ source: block, ...call, data: { features: scriptFeatures } },
					';',
				]];
			},
		})),
	);
	expect(text).toContain('declare const x: typeof useFoo;');
	const copied = text.indexOf('declare const x: typeof ') + 'declare const x: typeof '.length;
	expect(mappings).toContainEqual(expect.objectContaining({
		virtualStart: copied,
		virtualEnd: copied + 'useFoo'.length,
		originalStart: content.indexOf('useFoo'),
		kind: SpanMapKind.Verbatim,
	}));
});

test('rejects a range of a plugin out of its block', () => {
	const content = `<script setup lang="ts">\nconst a = useFoo();\n</script>\n`;
	expect(() =>
		generateWith(
			content,
			plugin(({ ir }) => ({
				declarations() {
					const block = ir.scriptSetup!;
					return [
						{ source: block, start: 0, end: block.content.length + 1, data: { features: scriptFeatures }, text: 'Y' },
					];
				},
			})),
		)
	).toThrow(TypeError);
});

test('maps a range of a plugin with its own text as a whole to the range', () => {
	const content = `<script setup lang="ts">\nconst a = useFoo();\n</script>\n`;
	const { text, mappings } = generateWith(
		content,
		plugin(({ ir }) => ({
			declarations() {
				const block = ir.scriptSetup!;
				const call = rangeOf(block, 'useFoo');
				return [[`declare const x: `, {
					source: block,
					...call,
					data: { features: scriptFeatures },
					text: 'number[]',
				}, `;`]];
			},
		})),
	);
	const generated = text.indexOf('declare const x: number[];') + 'declare const x: '.length;
	expect(mappings).toContainEqual(expect.objectContaining({
		virtualStart: generated,
		virtualEnd: generated + 'number[]'.length,
		originalStart: content.indexOf('useFoo'),
		originalEnd: content.indexOf('useFoo') + 'useFoo'.length,
		kind: SpanMapKind.Atom,
	}));
});

const defineProps = `<script setup lang="ts">\nconst props = defineProps<{ a: string }>();\n</script>\n`;

test('keeps an insert of a plugin after the start of a type argument that Vue moves at the call', () => {
	const { text } = generateWith(
		defineProps,
		rewriteSetup((writer, block) => {
			const { start } = rangeOf(block, '{ a: string }');
			writer.insertAfter(start, '/* a */');
			writer.insertAfter(start, '/* b */');
		}),
	);
	expect(text).toContain('type __VLS_Props = { a: string };\nconst props = defineProps</* a *//* b */__VLS_Props>();');
});

test('moves an insert of a plugin before the start of a type argument with it', () => {
	const { text } = generateWith(
		defineProps,
		rewriteSetup((writer, block) => {
			const { start, end } = rangeOf(block, '{ a: string }');
			writer.insertBefore(start, 'Wrap<');
			writer.insertAfter(end, '>');
		}),
	);
	expect(text).toContain('type __VLS_Props = Wrap<{ a: string }>;\nconst props = defineProps<__VLS_Props>();');
});

test('applies a rewrite of a plugin inside a range that Vue moves to the moved code', () => {
	const { text } = generateWith(
		defineProps,
		rewriteSetup((writer, block) => {
			const { start, end } = rangeOf(block, 'string');
			writer.replace(start, end, '');
			writer.insertBefore(start, 'number');
		}),
	);
	expect(text).toContain('type __VLS_Props = { a: number };\nconst props = defineProps<__VLS_Props>();');
});

test('unites nested removals of two plugins and keeps the inserts of both, in either plugin order', () => {
	const content = `<script setup lang="ts">\nconst a = useFoo();\n</script>\n`;
	const replace = (text: string, code: string, name: string) =>
		rewriteSetup((writer, block) => {
			const { start, end } = rangeOf(block, text);
			writer.replace(start, end, '');
			writer.insertBefore(start, code);
		}, name);
	const first = replace('useFoo()', 'first()', 'first');
	const second = replace('Foo', 'Second', 'second');
	expect(generateWith(content, first, second).text).toContain('const a = first()Second;');
	expect(generateWith(content, second, first).text).toContain('const a = first()Second;');
});

test('splits a removal of a plugin across the imports and the body of `<script setup>`', () => {
	const { text } = generateWith(
		`<script lang="ts">\nexport const s = 1;\n</script>\n<script setup lang="ts">\nimport { a } from 'a';\nconst b = a;\n</script>\n`,
		rewriteSetup((writer, block) => {
			const { start, end } = rangeOf(block, `'a';\nconst`);
			writer.replace(start, end, '');
			writer.insertBefore(start, `'b'; let`);
		}),
	);
	expect(text).toContain(`import { a } from 'b'; let\n`);
	expect(text.indexOf(` b = a;\n`)).toBeGreaterThan(text.indexOf('await (async () => {'));
});

test('maps a `<script setup>` whose code a plugin removes by one empty copy', () => {
	const content = `<script setup lang="ts">\nconst a = 1;\n</script>\n`;
	const { text, mappings } = generateWith(
		content,
		rewriteSetup((writer, block) => writer.replace(0, block.content.length, '')),
	);
	expect(text).not.toContain('const a = 1;');
	expect(
		mappings.filter(({ virtualStart, virtualEnd, originalStart, originalEnd, features }) =>
			virtualStart === virtualEnd && originalStart === originalEnd && originalStart === content.indexOf('\n')
			&& features === scriptFeatures
		),
	).toHaveLength(1);
});

test('runs the codegen and each hook of the plugins once, in plugin order', () => {
	const calls: string[] = [];
	const traced = (name: string) =>
		plugin(() => {
			calls.push(`${name}.codegen`);
			return {
				rewrite: () => void calls.push(`${name}.rewrite`),
				declarations: () => (calls.push(`${name}.declarations`), []),
			};
		}, name);
	generateWith(`<script setup lang="ts">\nconst a = 1;\n</script>\n`, traced('first'), traced('second'));
	for (const hook of ['codegen', 'rewrite', 'declarations']) {
		expect(calls.filter(call => call.endsWith(`.${hook}`))).toEqual([`first.${hook}`, `second.${hook}`]);
	}
});

test('propagates an exception of the codegen and of a hook', () => {
	const fail = (what: string) => () => {
		throw new Error(`${what} failed`);
	};
	const codegens: [string, VueCodegenPlugin][] = [
		['codegen', fail('codegen')],
		['rewrite', () => ({ rewrite: fail('rewrite') })],
		['declarations', () => ({ declarations: fail('declarations') })],
	];
	for (const [what, codegen] of codegens) {
		expect(() => generateWith(`<script setup lang="ts">\nconst a = 1;\n</script>\n`, plugin(codegen)))
			.toThrow(`${what} failed`);
	}
});

test('names the identifiers of the plugins apart from the generated code and each other', () => {
	const names: string[][] = [];
	const naming = (name: string) =>
		plugin(file => {
			names.push([file.name('Foo'), file.name('ctx'), file.name('Foo')]);
			return {};
		}, name);
	generateWith(`<script setup lang="ts">\nconst a = 1;\n</script>\n`, naming('first'), naming('second'));
	expect(names).toEqual([
		['__VLS_Foo', '__VLS_ctx$1', '__VLS_Foo'],
		['__VLS_Foo$1', '__VLS_ctx$2', '__VLS_Foo$1'],
	]);
	const invalid: VueCodegenPlugin[] = [
		file => (file.name('a$b'), {}),
		file => ({ declarations: () => [file.name('Late')] }),
	];
	for (const codegen of invalid) {
		expect(() => generateWith(`<script setup lang="ts">\nconst a = 1;\n</script>\n`, plugin(codegen)))
			.toThrow(`'test-plugin'`);
	}
});

test('declares a template type of a plugin at the end of the template, for setup and the export', () => {
	const content = `<script setup lang="ts">\nconst a = 1;\n</script>\n<template><div /></template>\n`;
	const { text } = generateWith(
		content,
		plugin(file => {
			const Foo = file.name('Foo');
			return {
				templateTypes: () => [{ name: Foo, code: '{ foo: 1 }' }],
				declarations: () => [`declare const foo: ${Foo};`],
			};
		}),
	);
	expect(text).toContain('type __VLS_Foo = { foo: 1 };\n');
	expect(text).toContain(`type __VLS_Foo = ReturnType<typeof __VLS_template>['__VLS_Foo'];`);
	expect(() => generateWith(content, plugin(() => ({ templateTypes: () => [{ name: '__VLS_ctx', code: '{}' }] }))))
		.toThrow(`'test-plugin'`);
});

test('writes the code of a plugin after the props of an element of the template', () => {
	const content = `<template><div id="a" /></template>\n`;
	const { text } = generateWith(
		content,
		plugin(({ ir }) => ({
			elementEnd: () => new Map([[ir.template!.ast!.children[0] as never, ['/* div */']]]),
		})),
	);
	expect(text).toContain(`id: "a",\n});\n/* div */`);
	expect(() => generateWith(content, plugin(() => ({ elementEnd: () => new Map([[{} as never, ['/* div */']]]) }))))
		.toThrow(`'test-plugin'`);
});

test('makes the component generic over the type parameters of a plugin, after those of its attribute', () => {
	const typeParameter = plugin(() => ({ generic: () => ['T extends string'] }));
	const props = `const props = defineProps<{ a: T }>();`;
	expect(generateWith(`<script setup lang="ts">\n${props}\n</script>\n`, typeParameter).text)
		.toContain('(<T extends string,>(\n');
	expect(generateWith(`<script setup lang="ts" generic="U">\n${props}\n</script>\n`, typeParameter).text)
		.toContain('(<U,T extends string,>(\n');
});

test('checks the slot outlets of the template against the slots that a plugin declares, as the slots of the component', () => {
	const content = `<script setup lang="ts">\nconst mySlots = {} as { a(props: { x: number }): any };\n</script>\n`
		+ `<template><slot name="a" :x="1" /></template>\n`;
	const declaring = (name?: string) =>
		plugin(() => ({ declaredSlots: () => 'mySlots', componentSlots: () => ['typeof mySlots'] }), name);
	const { text } = generateWith(content, declaring());
	expect(text).toContain('__VLS_asFunctionalSlot(mySlots.a)');
	expect(text).toContain('__VLS_WithSlots<typeof __VLS_base, typeof mySlots>');
	expect(text).not.toContain('__VLS_Slots');
	expect(() => generateWith(content, declaring('first'), declaring('second')))
		.toThrow(`The codegen plugins 'first' and 'second' both declared the slots.`);
	expect(() => generateWith(content, plugin(() => ({ declaredSlots: () => 1 as never }))))
		.toThrow(`'test-plugin'`);
});

test('names the imports of the CSS modules apart from the identifiers of the plugins', () => {
	const names: string[] = [];
	const { text } = generate('/Comp.vue', `<style module src="./a.module.css"></style>\n`, undefined, [
		plugin(file => (names.push(file.name('style_0')), {})),
	]);
	expect(text).toContain(`import __VLS_style_0 from `);
	expect(names).toEqual(['__VLS_style_0$1']);
});
