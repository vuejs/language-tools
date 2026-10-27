import { SpanMapKind } from '@volar/language-core';
import { type IRScript, type IRScriptSetup, scriptFeatures } from '@vue/language-core';
import { expect, test } from 'vitest';
import type { CodegenPlugin, VueCodegenContribution, VueCodegenFile } from '../lib/codegen/plugin';
import { generate } from './utils';

function plugin(
	contribute: (file: VueCodegenFile) => VueCodegenContribution | undefined,
	name = 'test-plugin',
): CodegenPlugin {
	return { name, plugin: { contribute } };
}

function generateWith(content: string, ...plugins: CodegenPlugin[]) {
	const result = generate('/Comp.vue', content, undefined, plugins);
	for (const [generatedStart, generatedLength, sourceStart, sourceLength, kind] of result.mappings) {
		if (kind === SpanMapKind.Verbatim) {
			expect(result.text.slice(generatedStart, generatedStart + generatedLength))
				.toBe(content.slice(sourceStart, sourceStart + sourceLength));
		}
	}
	return result;
}

function rangeOf(block: IRScript | IRScriptSetup, text: string) {
	const start = block.content.indexOf(text);
	expect(start).toBeGreaterThanOrEqual(0);
	return { start, end: start + text.length };
}

test('applies the script edits of plugins, mapping the source text that they copy', () => {
	const content = `<script setup lang="ts">\nconst a = useFoo();\n</script>\n`;
	const { text, mappings } = generateWith(
		content,
		plugin(({ ir }) => {
			const block = ir.scriptSetup!;
			const call = rangeOf(block, 'useFoo()');
			return {
				scriptEdits: [
					{
						block,
						replace: call,
						code: ['wrap(', { text: 'useFoo()', block, offset: call.start, features: scriptFeatures }, ')'],
					},
					// not the source text at its offset, so it does not map
					{ block, insertAfter: call.end, code: [{ text: ' as X', block, offset: 0, features: scriptFeatures }] },
					// out of the content of the block
					{ block, replace: { start: 0, end: block.content.length + 1 }, code: ['dropped'] },
					// removes no char
					{ block, replace: { start: call.start, end: call.start }, code: ['dropped'] },
					// not exactly one edit
					{ block, insertBefore: call.start, insertAfter: call.start, code: ['dropped'] } as never,
					{ block, code: ['dropped'] } as never,
				],
			};
		}),
	);
	expect(text).toContain('const a = wrap(useFoo()) as X;');
	expect(text).not.toContain('dropped');
	const copied = text.indexOf('useFoo()');
	expect(
		mappings.some(([generatedStart, , sourceStart]) =>
			generatedStart === copied && sourceStart === content.indexOf('useFoo()')
		),
	).toBe(true);
	const unmapped = text.indexOf(' as X');
	expect(
		mappings.some(([generatedStart, generatedLength]) =>
			generatedStart <= unmapped && unmapped < generatedStart + generatedLength
		),
	).toBe(false);
});

const defineProps = `<script setup lang="ts">\nconst props = defineProps<{ a: string }>();\n</script>\n`;

test('keeps an insert of a plugin after the start of a type argument that Vue moves at the call', () => {
	const { text } = generateWith(
		defineProps,
		plugin(({ ir }) => {
			const block = ir.scriptSetup!;
			const { start } = rangeOf(block, '{ a: string }');
			return {
				scriptEdits: [{ block, insertAfter: start, code: ['/* a */'] }, {
					block,
					insertAfter: start,
					code: ['/* b */'],
				}],
			};
		}),
	);
	expect(text).toContain('type __VLS_Props = { a: string };\nconst props = defineProps</* a *//* b */__VLS_Props>();');
});

test('moves an insert of a plugin before the start of a type argument with it', () => {
	const { text } = generateWith(
		defineProps,
		plugin(({ ir }) => {
			const block = ir.scriptSetup!;
			const { start, end } = rangeOf(block, '{ a: string }');
			return {
				scriptEdits: [{ block, insertBefore: start, code: ['Wrap<'] }, { block, insertAfter: end, code: ['>'] }],
			};
		}),
	);
	expect(text).toContain('type __VLS_Props = Wrap<{ a: string }>;\nconst props = defineProps<__VLS_Props>();');
});

test('applies a script edit of a plugin inside a range that Vue moves to the moved code', () => {
	const { text } = generateWith(
		defineProps,
		plugin(({ ir }) => {
			const block = ir.scriptSetup!;
			return { scriptEdits: [{ block, replace: rangeOf(block, 'string'), code: ['number'] }] };
		}),
	);
	expect(text).toContain('type __VLS_Props = { a: number };\nconst props = defineProps<__VLS_Props>();');
});

test('applies nested replaces of two plugins, each code at the start of its range, in either plugin order', () => {
	const content = `<script setup lang="ts">\nconst a = useFoo();\n</script>\n`;
	const first = plugin(({ ir }) => {
		const block = ir.scriptSetup!;
		return { scriptEdits: [{ block, replace: rangeOf(block, 'useFoo()'), code: ['first()'] }] };
	}, 'first');
	const second = plugin(({ ir }) => {
		const block = ir.scriptSetup!;
		return { scriptEdits: [{ block, replace: rangeOf(block, 'Foo'), code: ['Second'] }] };
	}, 'second');
	expect(generateWith(content, first, second).text).toContain('const a = first()Second;');
	expect(generateWith(content, second, first).text).toContain('const a = first()Second;');
});

test('splits a replace of a plugin across the imports and the body of `<script setup>`', () => {
	const { text } = generateWith(
		`<script lang="ts">\nexport const s = 1;\n</script>\n<script setup lang="ts">\nimport { a } from 'a';\nconst b = a;\n</script>\n`,
		plugin(({ ir }) => {
			const block = ir.scriptSetup!;
			return { scriptEdits: [{ block, replace: rangeOf(block, `'a';\nconst`), code: [`'b'; let`] }] };
		}),
	);
	expect(text).toContain(`import { a } from 'b'; let\n`);
	expect(text.indexOf(` b = a;\n`)).toBeGreaterThan(text.indexOf('await (async () => {'));
});

test('maps a `<script setup>` whose code a plugin removes by one empty copy', () => {
	const content = `<script setup lang="ts">\nconst a = 1;\n</script>\n`;
	const { text, mappings } = generateWith(
		content,
		plugin(({ ir }) => {
			const block = ir.scriptSetup!;
			return { scriptEdits: [{ block, replace: { start: 0, end: block.content.length }, code: [] }] };
		}),
	);
	expect(text).not.toContain('const a = 1;');
	expect(
		mappings.filter(([, generatedLength, sourceStart, sourceLength, , features]) =>
			!generatedLength && !sourceLength && sourceStart === content.indexOf('\n') && features === scriptFeatures
		),
	).toHaveLength(1);
});

test('propagates an exception of contribute', () => {
	expect(() =>
		generateWith(
			`<script setup lang="ts">\nconst a = 1;\n</script>\n`,
			plugin(() => {
				throw new Error('contribute failed');
			}),
		)
	).toThrow('contribute failed');
});
