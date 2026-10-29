import * as path from 'node:path';
import { expect, test } from 'vitest';
import { createContentMapper } from '../lib/mapper/contentMapper';
import { repositoryRoot } from './utils';

const fixtureDir = path.join(repositoryRoot, 'test-workspace/content-mapper-virtual-code/ts');

test('top-level assertions skip imports and mutable bindings read only inside functions', () => {
	const mapper = createContentMapper({ name: 'test' });
	mapper.openProject({
		projectHandle: 'ts',
		configFileName: path.join(fixtureDir, 'tsconfig.json'),
		compilerOptions: {},
	});
	const { text } = mapper.transform({
		projectHandle: 'ts',
		fileName: path.join(fixtureDir, 'TopLevelAssertions.vue'),
		content: `<script setup lang="ts">
import { EMPTY_ID, SOME_CONST } from '../constants';
const rows = ['a'];
let count = 1;
let clicks = 0;
</script>

<template>
	<div v-if="count" />
	{{ rows.map(() => SOME_CONST.A) }}
	<button @click="clicks++; EMPTY_ID.length" />
</template>
`,
	});
	const topLevel = text.slice(text.indexOf('__VLS_withDotValue('), text.indexOf('if (count.value)'));
	expect(topLevel.match(/(?<=__VLS_withDotValue\()\w+/g)).toEqual(['count', 'rows']);
});
