import { expect, it } from 'vitest';
import { getBaseNameWithoutExtension } from '../lib/utils/names';

it('strips only the last extension from the file name, like @vue/compiler-core', () => {
	expect(getBaseNameWithoutExtension('/project/src/my-comp.vue')).toBe('my-comp');
	expect(getBaseNameWithoutExtension('/project/src/page.md')).toBe('page');
	expect(getBaseNameWithoutExtension('/project/src/page.vue.md')).toBe('page.vue');
	expect(getBaseNameWithoutExtension('C:/project/src/page.vue.md')).toBe('page.vue');
});
