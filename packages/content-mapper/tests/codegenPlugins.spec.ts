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
						...call,
						code: ['wrap(', { text: 'useFoo()', block, offset: call.start, features: scriptFeatures }, ')'],
					},
					// not the source text at its offset, so it does not map
					{
						block,
						start: call.end,
						end: call.end,
						code: [{ text: ' as X', block, offset: 0, features: scriptFeatures }],
					},
					// out of the content of the block
					{ block, start: 0, end: block.content.length + 1, code: ['dropped'] },
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

test('applies an insert of a plugin before a transform of Vue at the same position', () => {
	const { text } = generateWith(
		`<script setup lang="ts">\nconst props = defineProps<{ a: string }>();\n</script>\n`,
		plugin(({ ir }) => {
			const block = ir.scriptSetup!;
			const { start } = rangeOf(block, '{ a: string }');
			return {
				scriptEdits: [{ block, start, end: start, code: ['/* a */'] }, { block, start, end: start, code: ['/* b */'] }],
			};
		}),
	);
	expect(text).toContain('defineProps</* a *//* b */__VLS_Props>();');
});

test('fails the transform when a script edit of a plugin overlaps a transform of Vue', () => {
	expect(() =>
		generateWith(
			`<script setup lang="ts">\nconst props = defineProps<{ a: string }>();\n</script>\n`,
			plugin(({ ir }) => {
				const block = ir.scriptSetup!;
				return { scriptEdits: [{ block, ...rangeOf(block, 'string'), code: ['number'] }] };
			}, 'overlapping-plugin'),
		)
	).toThrow(`Plugin 'overlapping-plugin': the script edit at 32..38 overlaps a code transform of Vue at 27..40.`);
});

test('drops a script edit of a plugin that overlaps an edit of an earlier plugin', () => {
	const { text } = generateWith(
		`<script setup lang="ts">\nconst a = useFoo();\n</script>\n`,
		plugin(({ ir }) => {
			const block = ir.scriptSetup!;
			return { scriptEdits: [{ block, ...rangeOf(block, 'useFoo()'), code: ['first()'] }] };
		}, 'first'),
		plugin(({ ir }) => {
			const block = ir.scriptSetup!;
			return { scriptEdits: [{ block, ...rangeOf(block, 'Foo'), code: ['Second'] }] };
		}, 'second'),
	);
	expect(text).toContain('const a = first();');
	expect(text).not.toContain('Second');
});

test('applies a script edit at an end of the default export of `<script>` to the copy of the exported expression', () => {
	const { text } = generateWith(
		`<script lang="ts">\nexport default {};\n</script>\n`,
		plugin(({ ir }) => {
			const block = ir.script!;
			const { start, end } = rangeOf(block, '{}');
			return {
				scriptEdits: [{ block, start, end: start, code: ['wrap('] }, { block, start: end, end, code: [')'] }],
			};
		}),
	);
	expect(text).toContain(`export default {} as typeof __VLS_export;`);
	expect(text).toContain(`const __VLS_export = (await import('vue')).defineComponent(wrap({}));`);
});

test('fails the transform when a script edit of a plugin spans sections that Vue copies to different places', () => {
	expect(() =>
		generateWith(
			`<script setup lang="ts">\nimport { a } from 'a';\nconst b = a;\n</script>\n`,
			plugin(({ ir }) => {
				const block = ir.scriptSetup!;
				return { scriptEdits: [{ block, ...rangeOf(block, `'a';\nconst`), code: [`'b'; let`] }] };
			}, 'spanning-plugin'),
		)
	).toThrow(`Plugin 'spanning-plugin': the script edit at 19..29 spans sections of the block that Vue copies to different places.`);
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
