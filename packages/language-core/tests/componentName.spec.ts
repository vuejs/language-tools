import { forEachEmbeddedCode } from '@volar/language-core';
import * as ts from 'typescript';
import { expect, it } from 'vitest';
import { names } from '../lib/codegen/names';
import { getDefaultCompilerOptions } from '../lib/compilerOptions';
import { createVueLanguagePlugin } from '../lib/languagePlugin';
import type { VueCompilerOptions } from '../lib/types';
import { getBaseNameWithoutExtension } from '../lib/utils/shared';

function createVueCompilerOptions(
	extensionFormats: Record<string, VueCompilerOptions['format']> = { '.vue': 'sfc', '.vue.md': 'vitepress' },
	format: VueCompilerOptions['format'] = 'sfc',
) {
	const vueCompilerOptions = getDefaultCompilerOptions();
	vueCompilerOptions.extensionFormats = extensionFormats;
	vueCompilerOptions.format = format;
	return vueCompilerOptions;
}

it('strips the longest matching configured extension from the file name', () => {
	const vueCompilerOptions = createVueCompilerOptions();
	expect(getBaseNameWithoutExtension('/project/src/page.vue.md', vueCompilerOptions)).toBe('page');
	expect(getBaseNameWithoutExtension('/project/src/my-comp.vue', vueCompilerOptions)).toBe('my-comp');
	expect(getBaseNameWithoutExtension('/project/src/readme.md', vueCompilerOptions)).toBe('readme');
	expect(getBaseNameWithoutExtension('C:/project/src/page.vue.md', vueCompilerOptions)).toBe('page');
});

it('takes the name from the longest matching extension, regardless of order', () => {
	const vueCompilerOptions = createVueCompilerOptions({ '.vue': 'sfc', '.md': 'petite-vue', '.vue.md': 'vitepress' });
	expect(getBaseNameWithoutExtension('/project/src/page.vue.md', vueCompilerOptions)).toBe('page');
	expect(getBaseNameWithoutExtension('/project/src/readme.md', vueCompilerOptions)).toBe('readme');
});

it('parses every file by the format option, whatever its extension', () => {
	const vueCompilerOptions = createVueCompilerOptions({ '.vue': 'sfc', '.vue.md': 'vitepress' }, 'petite-vue');
	const plugin = createVueLanguagePlugin<string>(ts, vueCompilerOptions, id => id);
	expect(plugin.getLanguageId('/project/src/page.vue.md')).toBe('html');
	expect(plugin.getLanguageId('/project/src/comp.vue')).toBe('html');
});

it.each([
	['.vue.md only', { '.vue': 'sfc', '.vue.md': 'vitepress' } as const],
	['.md before .vue.md', { '.vue': 'sfc', '.md': 'petite-vue', '.vue.md': 'vitepress' } as const],
])('derives the self component name from a multi-dot extension (%s)', (_, extensionFormats) => {
	const fileName = '/project/src/page.vue.md';
	const plugin = createVueLanguagePlugin<string>(
		ts,
		createVueCompilerOptions(extensionFormats, 'vitepress'),
		id => id,
	);
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
