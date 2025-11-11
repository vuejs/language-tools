import { createVueLanguagePlugin, getDefaultCompilerOptions } from '@vue/language-core';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { URI } from 'vscode-uri';
import { createVueLanguageServicePlugins } from '../..';
import { createAutoInserter } from '../utils/autoInsert';

const vueCompilerOptions = getDefaultCompilerOptions();
const vueLanguagePlugin = createVueLanguagePlugin<URI>(
	ts,
	{},
	vueCompilerOptions,
	() => '',
);
const vueServicePLugins = createVueLanguageServicePlugins(ts);
const autoInserter = createAutoInserter([vueLanguagePlugin], vueServicePLugins);

describe('auto insert inside interpolations', () => {
	it('avoids completing HTML tags inside interpolation', async () => {
		const snippet = await autoInserter.autoInsert(
			`
<template>
	{{ "<div>|" }}
</template>
`,
			'>',
		);

		expect(snippet).toBeUndefined();
	});

	it('still completes HTML tags in plain template regions', async () => {
		const snippet = await autoInserter.autoInsert(
			`
	<template>
		<div>|
	</template>
`,
			'>',
		);

		expect(snippet).toBe('$0</div>');
	});

	it('completes HTML tags when bracket are inside HTML comments', async () => {
		const snippet = await autoInserter.autoInsert(
			`
<template>
	<!-- {{ -->
	<div>|
	<!-- }}-->
</template>
`,
			'>',
		);

		expect(snippet).toBe('$0</div>');
	});

	it('completes closing tags even if previous interpolation contains HTML strings', async () => {
		const snippet = await autoInserter.autoInsert(
			`
<template>
	<div>{{ "<div></div>" }}</|
</template>
`,
			'/',
		);

		expect(snippet).toBe('div>');
	});

	it('avoids closing tags spawned from string literals when typing `</`', async () => {
		const snippet = await autoInserter.autoInsert(
			`
	<template>
		{{ "<div>" }}</|
	</template>
`,
			'/',
		);

		expect(snippet).toBeUndefined();
	});
});
