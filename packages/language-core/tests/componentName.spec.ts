import { forEachEmbeddedCode } from '@volar/language-core';
import * as ts from 'typescript';
import { expect, it } from 'vitest';
import { names } from '../lib/codegen/names';
import { getDefaultCompilerOptions } from '../lib/compilerOptions';
import { createVueLanguagePlugin } from '../lib/languagePlugin';
import { getBaseNameWithoutExtension } from '../lib/utils/shared';

function createVueCompilerOptions() {
	const vueCompilerOptions = getDefaultCompilerOptions();
	vueCompilerOptions.extensionFormats = { '.vue': 'sfc', '.vue.md': 'vitepress' };
	return vueCompilerOptions;
}

it('strips the longest matching configured extension from the file name', () => {
	const vueCompilerOptions = createVueCompilerOptions();
	expect(getBaseNameWithoutExtension('/project/src/page.vue.md', vueCompilerOptions)).toBe('page');
	expect(getBaseNameWithoutExtension('/project/src/my-comp.vue', vueCompilerOptions)).toBe('my-comp');
	expect(getBaseNameWithoutExtension('/project/src/readme.md', vueCompilerOptions)).toBe('readme');
	expect(getBaseNameWithoutExtension('C:/project/src/page.vue.md', vueCompilerOptions)).toBe('page');
});

it('derives the self component name from a multi-dot extension', () => {
	const fileName = '/project/src/page.vue.md';
	const plugin = createVueLanguagePlugin<string>(ts, createVueCompilerOptions(), id => id);
	const code = plugin.createVirtualCode!(
		fileName,
		'markdown',
		ts.ScriptSnapshot.fromString('<script setup lang="ts"></script>\n\n<Page />\n'),
		undefined as any,
	)!;
	const script = [...forEachEmbeddedCode(code)].find(code => code.id === 'script_ts')!;
	const generated = script.snapshot.getText(0, script.snapshot.getLength());
	expect(generated).toContain(`<'Page', ${names.LocalComponents}, ${names.GlobalComponents}, typeof ${names.export}`);
});
