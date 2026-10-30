import { SpanMapKind } from '@volar/language-core';
import { type IRScript, type IRScriptSetup, scriptFeatures } from '@vue/language-core';
import { expect, test } from 'vitest';
import type { CodegenPlugin, VueCodegenFile, VueCodegenPlugin, VueCodegenWriter } from '../lib/codegen/plugin';
import { generate } from './utils';

function plugin(hooks: VueCodegenPlugin, name = 'test-plugin'): CodegenPlugin {
	return { name, plugin: hooks };
}

/** A plugin that rewrites the `<script setup>` of the file. */
function rewriteSetup(
	rewrite: (writer: VueCodegenWriter, block: IRScriptSetup, file: VueCodegenFile) => void,
	name?: string,
): CodegenPlugin {
	return plugin({ rewrite: (file, { scriptSetup }) => rewrite(scriptSetup!, file.ir.scriptSetup!, file) }, name);
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

test('applies the rewrites of plugins, mapping the source ranges that they keep', () => {
	const content = `<script setup lang="ts">\nconst a = useFoo();\n</script>\n`;
	const { text, mappings } = generateWith(
		content,
		rewriteSetup((writer, block) => {
			const call = rangeOf(block, 'useFoo()');
			writer.insertBefore(call.start, 'wrap(');
			writer.insertAfter(call.end, ')');
			writer.insertAfter(call.end, ' as X');
			// out of the content of the block
			writer.insertBefore(block.content.length + 1, 'dropped');
			writer.remove(0, block.content.length + 1);
			// removes no char
			writer.remove(call.start, call.start);
			// not a string
			writer.insertBefore(call.start, ['dropped'] as never);
		}),
	);
	expect(text).toContain('const a = wrap(useFoo()) as X;');
	expect(text).not.toContain('dropped');
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

test('maps a range of a plugin without text as a copy, and drops the mapping of a range out of its block', () => {
	const content = `<script setup lang="ts">\nconst a = useFoo();\n</script>\n`;
	const { text, mappings } = generateWith(
		content,
		plugin({
			generate({ ir }) {
				const block = ir.scriptSetup!;
				const call = rangeOf(block, 'useFoo');
				return {
					declarations: [[
						'declare const x: typeof ',
						{ source: block, ...call, data: { features: scriptFeatures } },
						', y: ',
						{ source: block, start: 0, end: block.content.length + 1, data: { features: scriptFeatures }, text: 'Y' },
						';',
					]],
				};
			},
		}),
	);
	expect(text).toContain('declare const x: typeof useFoo, y: Y;');
	const copied = text.indexOf('declare const x: typeof ') + 'declare const x: typeof '.length;
	expect(
		mappings.some(({ virtualStart, originalStart }) =>
			virtualStart === copied && originalStart === content.indexOf('useFoo')
		),
	).toBe(true);
	const unmapped = text.indexOf(', y: Y') + ', y: '.length;
	expect(
		mappings.some(({ virtualStart, virtualEnd }) => virtualStart <= unmapped && unmapped < virtualEnd),
	).toBe(false);
});

test('maps a range of a plugin with its own text as a whole to the range', () => {
	const content = `<script setup lang="ts">\nconst a = useFoo();\n</script>\n`;
	const { text, mappings } = generateWith(
		content,
		plugin({
			generate({ ir }) {
				const block = ir.scriptSetup!;
				const call = rangeOf(block, 'useFoo');
				return {
					declarations: [[`declare const x: `, {
						source: block,
						...call,
						data: { features: scriptFeatures },
						text: 'number',
					}, `;`]],
				};
			},
		}),
	);
	const generated = text.indexOf('declare const x: number;') + 'declare const x: '.length;
	expect(mappings).toContainEqual(expect.objectContaining({
		virtualStart: generated,
		virtualEnd: generated + 'number'.length,
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
			writer.remove(start, end);
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
			writer.remove(start, end);
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
			writer.remove(start, end);
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
		rewriteSetup((writer, block) => writer.remove(0, block.content.length)),
	);
	expect(text).not.toContain('const a = 1;');
	expect(
		mappings.filter(({ virtualStart, virtualEnd, originalStart, originalEnd, features }) =>
			virtualStart === virtualEnd && originalStart === originalEnd && originalStart === content.indexOf('\n')
			&& features === scriptFeatures
		),
	).toHaveLength(1);
});

test('runs the rewrites of all plugins before any generate', () => {
	const calls: string[] = [];
	const traced = (name: string) =>
		plugin({
			rewrite: () => void calls.push(`${name}.rewrite`),
			generate: () => void calls.push(`${name}.generate`),
		}, name);
	generateWith(`<script setup lang="ts">\nconst a = 1;\n</script>\n`, traced('first'), traced('second'));
	expect(calls).toEqual(['first.rewrite', 'second.rewrite', 'first.generate', 'second.generate']);
});

test('propagates an exception of a hook', () => {
	for (const hook of ['rewrite', 'generate'] as const) {
		expect(() =>
			generateWith(
				`<script setup lang="ts">\nconst a = 1;\n</script>\n`,
				plugin({
					[hook]() {
						throw new Error(`${hook} failed`);
					},
				}),
			)
		).toThrow(`${hook} failed`);
	}
});
