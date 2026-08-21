import { createUriMap, type LanguageServiceContext } from '@volar/language-service';
import { createLanguage, createVueLanguagePlugin, getDefaultCompilerOptions } from '@vue/language-core';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { URI } from 'vscode-uri';
import { getAttrNameCasing, getTagNameCasing } from '../lib/nameCasing';
import type { AttrNameCasing, TagNameCasing } from '../lib/nameCasing';

const vueLanguagePlugin = createVueLanguagePlugin<URI>(
	ts,
	{},
	getDefaultCompilerOptions(),
	uri => uri.path,
);

function createTestContext() {
	const language = createLanguage<URI>(
		[vueLanguagePlugin],
		createUriMap(false),
		() => {},
	);
	const context = {
		language,
		env: {},
	} as LanguageServiceContext;
	return { language, context };
}

describe('nameCasing detection', () => {
	it('tag casing follows template edits', async () => {
		const { language, context } = createTestContext();
		const uri = URI.parse('file:///tagCasing.vue');

		language.scripts.set(uri, ts.ScriptSnapshot.fromString(`<template><MyComp /></template>`), 'vue');
		expect(await getTagNameCasing(context, uri)).toBe(1 satisfies TagNameCasing.Pascal);

		language.scripts.set(uri, ts.ScriptSnapshot.fromString(`<template><my-comp /></template>`), 'vue');
		expect(await getTagNameCasing(context, uri)).toBe(0 satisfies TagNameCasing.Kebab);
	});

	it('attr casing follows template edits', async () => {
		const { language, context } = createTestContext();
		const uri = URI.parse('file:///attrCasing.vue');

		language.scripts.set(uri, ts.ScriptSnapshot.fromString(`<template><MyComp :fooBar="1" /></template>`), 'vue');
		expect(await getAttrNameCasing(context, uri)).toBe(1 satisfies AttrNameCasing.Camel);

		language.scripts.set(uri, ts.ScriptSnapshot.fromString(`<template><MyComp :foo-bar="1" /></template>`), 'vue');
		expect(await getAttrNameCasing(context, uri)).toBe(0 satisfies AttrNameCasing.Kebab);
	});

	it('detection recovers after the first query saw no template block', async () => {
		const { language, context } = createTestContext();
		const uri = URI.parse('file:///noTemplate.vue');

		language.scripts.set(uri, ts.ScriptSnapshot.fromString(`<script setup lang="ts">const a = 1;</script>`), 'vue');
		expect(await getTagNameCasing(context, uri)).toBe(1 satisfies TagNameCasing.Pascal);

		language.scripts.set(
			uri,
			ts.ScriptSnapshot.fromString(`<template><my-comp /></template><script setup lang="ts">const a = 1;</script>`),
			'vue',
		);
		expect(await getTagNameCasing(context, uri)).toBe(0 satisfies TagNameCasing.Kebab);
	});
});
