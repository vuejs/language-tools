import {
	createVueLanguagePlugin,
	forEachEmbeddedCode,
	getDefaultCompilerOptions,
	type VueCompilerOptions,
} from '@vue/language-core';
import { expect, it } from 'vitest';
import { names } from '../lib/codegen/names';
import vueTsxPlugin from '../lib/vueTsx';
import { loadTypeScript } from '@vue/language-core/lib/typescript';
import { createSnapshot } from './utils';

function generateScript(fileName: string, format: VueCompilerOptions['format'], content: string) {
	const vueCompilerOptions = getDefaultCompilerOptions();
	vueCompilerOptions.format = format;
	const plugin = createVueLanguagePlugin<string>(loadTypeScript(), vueCompilerOptions, id => id, [vueTsxPlugin]);
	const code = plugin.createVirtualCode!(fileName, 'vue', createSnapshot(content), undefined as any)!;
	const script = [...forEachEmbeddedCode(code)].find(code => code.id === 'script_ts')!;
	return script.snapshot.getText(0, script.snapshot.getLength());
}

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
