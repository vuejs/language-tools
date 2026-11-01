import { expect, test } from 'vitest';
import { generate } from './utils';

test('re-asserts the bindings of a function whose parameter default or body a parse error leaves empty', () => {
	const source = `<script setup lang="ts">
let a: number | undefined = 1;
</script>

<template>
	<div v-if="a" />
	<div :x="(p = ) => a" :y="(p = a) => " />
</template>
`;
	const { text } = generate('/Comp.vue', source);
	expect(text).toMatch(/\(\(p =[^)]*\) => \{\n__VLS_withDotValue\(a, /);
	expect(text).toContain(`((p = (() => {\n__VLS_withDotValue(a, `);
});
