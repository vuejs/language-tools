import { expect, test } from 'vitest';
import {
	createLanguage,
	createVueLanguagePlugin,
	forEachEmbeddedCode,
	getDefaultCompilerOptions,
	vueTsxPlugin,
} from '../index';
import { createSnapshot, ts } from './typescript';

test('mappings within a hyphenated directive name cover the whole name', () => {
	const language = createLanguage<string>(
		[createVueLanguagePlugin<string>(ts, getDefaultCompilerOptions(), fileName => fileName, [vueTsxPlugin])],
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
	const root = language.scripts.set('/Comp.vue', createSnapshot(source), 'vue')!.generated!.root;
	const script = [...forEachEmbeddedCode(root)].find(code => code.id === 'script_ts')!;

	const spans = script.mappings
		.map(([, , sourceStart, sourceLength]): [number, number] => [sourceStart, sourceStart + sourceLength])
		.filter(([rangeStart, rangeEnd]) => rangeEnd > rangeStart && rangeStart >= start && rangeEnd <= end);

	expect(spans.length).toBeGreaterThan(0);
	for (const span of spans) {
		expect(span).toEqual([start, end]);
	}
});
