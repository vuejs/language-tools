import * as ts from 'typescript';
import { expect, test } from 'vitest';
import { createLanguage, createVueLanguagePlugin, forEachEmbeddedCode, getDefaultCompilerOptions } from '../index';

test('mappings within a hyphenated directive name cover the whole name', () => {
	const language = createLanguage<string>(
		[createVueLanguagePlugin<string>(ts, getDefaultCompilerOptions(), fileName => fileName)],
		new Map(),
		() => {},
	);
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
	const root = language.scripts.set('/Comp.vue', ts.ScriptSnapshot.fromString(source), 'vue')!.generated!.root;
	const script = [...forEachEmbeddedCode(root)].find(code => code.id === 'script_ts')!;

	const spans = script.mappings
		.map(mapping =>
			mapping.sourceOffsets.map((offset, i) => [offset, offset + (mapping.lengths[i] ?? 0)] as const)
				.filter(([rangeStart, rangeEnd]) => rangeEnd > rangeStart)
		)
		.filter(ranges => ranges.length && ranges.every(([rangeStart, rangeEnd]) => rangeStart >= start && rangeEnd <= end))
		.map(ranges => [Math.min(...ranges.map(range => range[0])), Math.max(...ranges.map(range => range[1]))]);

	expect(spans.length).toBeGreaterThan(0);
	for (const span of spans) {
		expect(span).toEqual([start, end]);
	}
});
