import { scriptFeatures } from '@vue/language-core';
import { expect, test } from 'vitest';
import { generate } from './utils';

test('maps no empty copy of the user code at the start of an unnamed macro statement', () => {
	const content = `<script setup lang="ts">\ndefineProps<{ a: string }>();\n</script>\n`;
	const statementStart = content.indexOf('defineProps');
	const { text, mappings } = generate('/Comp.vue', content);
	expect(text).toContain(`type __VLS_Props = { a: string };\nconst __VLS_props = defineProps<__VLS_Props>();`);
	expect(
		mappings.filter(([, generatedLength, sourceStart, sourceLength, , features]) =>
			!generatedLength && !sourceLength && sourceStart === statementStart && features === scriptFeatures
		),
	).toEqual([]);
});

test('hoists the macros of one statement in order, copying the statement once', () => {
	const content =
		`<script setup lang="ts">\nconst { x } = defineProps<{ x: 1 }>(), { y } = defineEmits<{ y: [] }>();\n</script>\n`;
	const { text, mappings } = generate('/Comp.vue', content);
	expect(text).toContain(
		`type __VLS_Emit = { y: [] };\n`
			+ `const __VLS_emit = defineEmits<__VLS_Emit>();\n`
			+ `type __VLS_Props = { x: 1 };\n`
			+ `const __VLS_props = defineProps<__VLS_Props>();\n`
			+ `const { x } = __VLS_props, { y } = __VLS_emit;\n`,
	);
	for (const copied of ['const { x } = ', 'defineProps<', 'defineEmits<']) {
		const sourceStart = content.indexOf(copied);
		expect(
			mappings.filter(([, generatedLength, start, sourceLength, , features]) =>
				generatedLength && start <= sourceStart && sourceStart < start + sourceLength && features === scriptFeatures
			),
		).toHaveLength(1);
	}
});

test('maps a wholly empty block by one empty copy', () => {
	for (const content of [`<script setup lang="ts"></script>\n`, `<script lang="ts"></script>\n`]) {
		const blockStart = content.indexOf('>') + 1;
		const { mappings } = generate('/Comp.vue', content);
		expect(
			mappings.filter(([, generatedLength, sourceStart, sourceLength, , features]) =>
				!generatedLength && !sourceLength && sourceStart === blockStart && features === scriptFeatures
			),
		).toHaveLength(1);
	}
});

test('maps no empty copy of the user code at the end of a block that ends with its default export', () => {
	const content = `<script lang="ts">\nexport default {};</script>\n`;
	const blockEnd = content.indexOf('</script>');
	const { mappings } = generate('/Comp.vue', content);
	expect(
		mappings.filter(([, generatedLength, sourceStart, sourceLength, , features]) =>
			!generatedLength && !sourceLength && sourceStart === blockEnd && features === scriptFeatures
		),
	).toEqual([]);
});
