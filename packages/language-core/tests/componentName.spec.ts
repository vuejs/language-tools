import { forEachEmbeddedCode } from '@volar/language-core';
import * as ts from 'typescript';
import { expect, it } from 'vitest';
import { names } from '../lib/codegen/names';
import { getDefaultCompilerOptions } from '../lib/compilerOptions';
import { createVueLanguagePlugin } from '../lib/languagePlugin';
import type { VueCompilerOptions } from '../lib/types';
import { getBaseNameWithoutExtension } from '../lib/utils/shared';

function generateScript(fileName: string, format: VueCompilerOptions['format'], content: string) {
	const vueCompilerOptions = getDefaultCompilerOptions();
	vueCompilerOptions.format = format;
	const plugin = createVueLanguagePlugin<string>(ts, vueCompilerOptions, id => id);
	const code = plugin.createVirtualCode!(fileName, 'vue', ts.ScriptSnapshot.fromString(content), undefined as any)!;
	const script = [...forEachEmbeddedCode(code)].find(code => code.id === 'script_ts')!;
	return script.snapshot.getText(0, script.snapshot.getLength());
}

it('strips only the last extension from the file name, like @vue/compiler-core', () => {
	expect(getBaseNameWithoutExtension('/project/src/my-comp.vue')).toBe('my-comp');
	expect(getBaseNameWithoutExtension('/project/src/page.md')).toBe('page');
	expect(getBaseNameWithoutExtension('/project/src/page.vue.md')).toBe('page.vue');
	expect(getBaseNameWithoutExtension('C:/project/src/page.vue.md')).toBe('page.vue');
});

it('parses every file by the format option, whatever its extension', () => {
	const vueCompilerOptions = getDefaultCompilerOptions();
	vueCompilerOptions.format = 'petite-vue';
	const plugin = createVueLanguagePlugin<string>(ts, vueCompilerOptions, id => id);
	expect(plugin.getLanguageId('/project/src/page.vue.md')).toBe('html');
	expect(plugin.getLanguageId('/project/src/comp.vue')).toBe('html');
});

it.each([
	['/project/src/page.md', true],
	['/project/src/page.vue.md', false],
])('derives the self component name of %s from its last extension', (fileName, isSelf) => {
	const generated = generateScript(fileName, 'vitepress', '<script setup lang="ts"></script>\n\n<Page />\n');
	expect(generated).toContain(
		`<'Page', ${names.LocalComponents}, ${names.GlobalComponents}, ${isSelf ? `typeof ${names.export}` : 'void'}`,
	);
});

it('refers a tag to the setup binding of its name, whatever it is imported from', () => {
	const generated = generateScript(
		'/project/src/App.vue',
		'sfc',
		`<script setup lang="ts">\nimport Foo from './Foo.tsx';\nimport { Bar } from './bar';\n</script>\n\n<template><Foo /><bar /></template>\n`,
	);
	expect(generated).toContain(`= ${names.unwrap}(Foo, `);
	expect(generated).toContain(`= ${names.unwrap}(Bar, `);
	expect(generated).not.toContain(`${names.WithComponent}<'Foo'`);
	expect(generated).not.toContain(`${names.WithComponent}<'bar'`);
});
