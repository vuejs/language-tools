import { expect, test } from 'vitest';
import { getDefaultCompilerOptions } from '../lib/compilerOptions';
import { createVueLanguagePlugin } from '../lib/languagePlugin';
import { createSnapshot, ts } from './typescript';

const fileName = '/project/src/Comp.vue';
const before = '<template><div>{{ before }}</div></template>\n';
const after = '<template><span>{{ after }}</span></template>\n';

function text(code: { snapshot: { getText(start: number, end: number): string; getLength(): number } }) {
	return code.snapshot.getText(0, code.snapshot.getLength());
}

test.each([
	['the same plugin', 1],
	['plugins of equal options', 2],
])('virtual codes of the same id from %s are independent', (_, pluginCount) => {
	const [first, second = first] = Array.from(
		{ length: pluginCount },
		() => createVueLanguagePlugin<string>(ts, getDefaultCompilerOptions(), id => id),
	);
	const a = first!.createVirtualCode!(fileName, 'vue', createSnapshot(before), {} as never)!;
	const b = second!.createVirtualCode!(fileName, 'vue', createSnapshot(before), {} as never)!;
	expect(a).not.toBe(b);

	expect(first!.updateVirtualCode!(fileName, a, createSnapshot(after), {} as never)).toBe(a);
	expect(text(a)).toBe(after);
	expect(a.ir.template?.content).toContain('<span>');
	expect(text(b)).toBe(before);
	expect(b.ir.template?.content).toContain('<div>');
});
