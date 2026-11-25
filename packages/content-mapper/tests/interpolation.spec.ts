import { expect, test } from 'vitest';
import { generate } from './utils';

test('reads the shadowed binding in a function whose parameter default or body a parse error leaves empty', () => {
	const source = `<script setup lang="ts">
let a: number | undefined = 1;
</script>

<template>
	<div v-if="a" />
	<div :x="(p = ) => a" :y="(p = a) => " />
</template>
`;
	const { text } = generate('/Comp.vue', source);
	expect(text).toContain(`const { a } = __VLS_dotValueBindings();\n`);
	expect(text).toContain(`x: ((p =__VLS_ctx. ) => a.value),\n`);
	expect(text).toContain(`y: ((p = a.value) =>__VLS_ctx. ),\n`);
});
