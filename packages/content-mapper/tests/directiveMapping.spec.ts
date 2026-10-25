import { expect, test } from 'vitest';
import { generate } from './utils';

test('mappings within a hyphenated directive name cover the whole name', () => {
	const source = `<script setup lang="ts">
import { vOnClickOutside } from '@vueuse/components';
</script>

<template>
	<div v-on-click-outside="() => {}" />
</template>
`;
	const name = 'v-on-click-outside';
	const start = source.indexOf(name);
	const end = start + name.length;
	const { mappings } = generate('/Comp.vue', source);

	const spans = mappings
		.map(([, , sourceStart, sourceLength]): [number, number] => [sourceStart, sourceStart + sourceLength])
		.filter(([rangeStart, rangeEnd]) => rangeEnd > rangeStart && rangeStart >= start && rangeEnd <= end);

	expect(spans.length).toBeGreaterThan(0);
	for (const span of spans) {
		expect(span).toEqual([start, end]);
	}
});
