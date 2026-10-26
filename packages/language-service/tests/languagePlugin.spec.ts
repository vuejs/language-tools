import { getDefaultCompilerOptions } from '@vue/language-core';
import * as ts from 'typescript';
import { expect, test } from 'vitest';
import { createVueLanguagePlugin } from '../lib/languagePlugin';
import { asCoreTypeScript } from '../lib/utils';

const createSnapshot = ts.ScriptSnapshot.fromString;

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
		() => createVueLanguagePlugin<string>(asCoreTypeScript(ts), getDefaultCompilerOptions(), id => id),
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

test('the embedded codes of the language service come from the built-in plugins alone', () => {
	const userPlugin = () => ({
		version: 4,
		getEmbeddedCodes: () => [{ id: 'user_code', lang: 'ts' }],
		resolveEmbeddedCode(_fileName: string, _ir: unknown, code: { id: string; content: unknown[] }) {
			code.content.push(`/* ${code.id} */`);
		},
	});
	const plugin = createVueLanguagePlugin<string>(asCoreTypeScript(ts), {
		...getDefaultCompilerOptions(),
		plugins: [{ name: 'user-plugin', file: '/project/user-plugin.js', config: {}, module: userPlugin }],
	}, id => id);
	const code = plugin.createVirtualCode!(fileName, 'vue', createSnapshot(before), {} as never)!;

	const [rootTags, ...others] = code.embeddedCodes;
	expect(others).toEqual([]);
	expect(rootTags!.embeddedCodes!.map(embeddedCode => [embeddedCode.id, text(embeddedCode)])).toEqual([
		['scriptsetup_raw', ''],
		['template', '<div>{{ before }}</div>'],
	]);
});

test('the virtual code of the language service reads its source', () => {
	const setupBefore = '<script setup lang="ts">const before = 1;</script>\n';
	const setupAfter = '<script setup lang="ts">const after = 1;</script>\n';
	const plugin = createVueLanguagePlugin<string>(asCoreTypeScript(ts), getDefaultCompilerOptions(), id => id);
	const code = plugin.createVirtualCode!(fileName, 'vue', createSnapshot(setupBefore), {} as never)!;
	expect(code.ir).toBe(code.source.ir);
	expect(code.scriptAnalysis).toBe(code.source.analysis);

	plugin.updateVirtualCode!(fileName, code, createSnapshot(setupAfter), {} as never);
	expect(text(code.source)).toBe(setupAfter);
	expect([...code.scriptAnalysis.getSetupBindings()]).toEqual(['after']);
});

test('parses every file by the format option, whatever its extension', () => {
	const vueCompilerOptions = getDefaultCompilerOptions();
	vueCompilerOptions.format = 'petite-vue';
	const plugin = createVueLanguagePlugin<string>(asCoreTypeScript(ts), vueCompilerOptions, id => id);
	expect(plugin.getLanguageId('/project/src/page.vue.md')).toBe('html');
	expect(plugin.getLanguageId('/project/src/comp.vue')).toBe('html');
});
