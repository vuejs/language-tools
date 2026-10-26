import { expect, test } from 'vitest';
import { generate } from './utils';

function generateSlot(slot: string) {
	const { text } = generate(
		'/Comp.vue',
		`<script setup lang="ts">\nconst foo = 1; const bar = 2;\n</script>\n<template><Comp v-slot="${slot}">{{ a }}</Comp></template>\n`,
	);
	return text.split('\n').find(line => line.includes('__VLS_vSlot('));
}

test('omits the types of slot parameters that reference bindings from the slot pattern', () => {
	expect(generateSlot('{ a }: { a: typeof foo }')).toMatch(
		/^const \[\{ a \}\] = __VLS_vSlot\(__VLS_nonNull\(__VLS_\d+\), \(_: \{ a: typeof foo \}, \) => \[\] as any\);$/,
	);
	expect(generateSlot('x: Foo<typeof bar>')).toMatch(
		/^const \[x\] = __VLS_vSlot\(__VLS_nonNull\(__VLS_\d+\), \(_: Foo<typeof bar>, \) => \[\] as any\);$/,
	);
});

test('keeps the default values of slot parameters in the slot pattern', () => {
	expect(generateSlot('{ a = foo }: { a?: number }')).toMatch(
		/^const \[\{ a = __VLS_unwrap\(foo, .*\) \}\] = __VLS_vSlot\(__VLS_nonNull\(__VLS_\d+\), \(_: \{ a\?: number \}, \) => \[\] as any\);$/,
	);
});
