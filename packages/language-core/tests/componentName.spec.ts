import { expect, it } from 'vitest';
import { getDefaultCompilerOptions } from '../lib/compilerOptions';
import { createVueLanguagePlugin } from '../lib/languagePlugin';
import { getBaseNameWithoutExtension } from '../lib/utils/shared';
import { ts } from './typescript';

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
