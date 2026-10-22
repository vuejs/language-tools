import { forEachEmbeddedCode } from '@volar/language-core';
import * as ts from 'typescript';
import { expect, it } from 'vitest';
import { names } from '../lib/codegen/names';
import { getDefaultCompilerOptions } from '../lib/compilerOptions';
import { createVueLanguagePlugin } from '../lib/languagePlugin';
import { getBaseNameWithoutExtension } from '../lib/utils/shared';
import { getFormat } from '../lib/virtualCode';

function createVueCompilerOptions(
	extensionFormats: Record<string, 'sfc' | 'vitepress' | 'petite-vue'> = { '.vue': 'sfc', '.vue.md': 'vitepress' },
) {
	const vueCompilerOptions = getDefaultCompilerOptions();
	vueCompilerOptions.extensionFormats = extensionFormats;
	return vueCompilerOptions;
}

it('strips the longest matching configured extension from the file name', () => {
	const vueCompilerOptions = createVueCompilerOptions();
	expect(getBaseNameWithoutExtension('/project/src/page.vue.md', vueCompilerOptions)).toBe('page');
	expect(getBaseNameWithoutExtension('/project/src/my-comp.vue', vueCompilerOptions)).toBe('my-comp');
	expect(getBaseNameWithoutExtension('/project/src/readme.md', vueCompilerOptions)).toBe('readme');
	expect(getBaseNameWithoutExtension('C:/project/src/page.vue.md', vueCompilerOptions)).toBe('page');
});

it('takes the format and the name from the longest matching extension, regardless of order', () => {
	const vueCompilerOptions = createVueCompilerOptions({ '.vue': 'sfc', '.md': 'petite-vue', '.vue.md': 'vitepress' });
	expect(getFormat(vueCompilerOptions, '/project/src/page.vue.md')).toBe('vitepress');
	expect(getBaseNameWithoutExtension('/project/src/page.vue.md', vueCompilerOptions)).toBe('page');
	expect(getFormat(vueCompilerOptions, '/project/src/readme.md')).toBe('petite-vue');
	expect(getBaseNameWithoutExtension('/project/src/readme.md', vueCompilerOptions)).toBe('readme');
});

it.each([
	['.vue.md only', { '.vue': 'sfc', '.vue.md': 'vitepress' } as const],
	['.md before .vue.md', { '.vue': 'sfc', '.md': 'petite-vue', '.vue.md': 'vitepress' } as const],
])('derives the self component name from a multi-dot extension (%s)', (_, extensionFormats) => {
	const fileName = '/project/src/page.vue.md';
	const plugin = createVueLanguagePlugin<string>(ts, createVueCompilerOptions(extensionFormats), id => id);
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
