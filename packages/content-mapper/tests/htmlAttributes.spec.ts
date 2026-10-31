import { getDefaultCompilerOptions } from '@vue/language-core';
import { expect, test } from 'vitest';
import { generate } from './utils';

test('skips default htmlAttributes on components (#6318)', () => {
	const { text } = generate(
		'/App.vue',
		`<script setup lang="ts">
import Child from './Child.vue'
</script>
<template>
	<Child label="ok" aria-label="close" role="button" />
</template>`,
	);

	// aria-* matches default htmlAttributes → not emitted into the props object
	expect(text).not.toContain(`'aria-label'`);
	// role is not in the default list → still emitted (unquoted identifier key)
	expect(text).toContain(`role: "button"`);
});

test('still emits htmlAttributes on native elements', () => {
	const { text } = generate(
		'/App.vue',
		`<template>
	<button aria-label="native" />
</template>`,
	);

	expect(text).toContain(`'aria-label'`);
});

test('honors extra htmlAttributes patterns such as role on components', () => {
	const options = getDefaultCompilerOptions();
	options.htmlAttributes = ['aria-*', 'role'];
	options.isHtmlAttribute = (name: string) =>
		name === 'role' || name.startsWith('aria-');

	const { text } = generate(
		'/App.vue',
		`<script setup lang="ts">
import Child from './Child.vue'
</script>
<template>
	<Child label="ok" aria-label="close" role="button" data-x="1" />
</template>`,
		options,
	);

	expect(text).not.toContain(`'aria-label'`);
	expect(text).not.toContain(`role: "button"`);
	// data-* still checked unless listed in dataAttributes (camelized key)
	expect(text).toContain(`dataX: "1"`);
});
