import * as CompilerDOM from '@vue/compiler-dom';
import { expect, test } from 'vitest';
import { petiteVueParser } from '../lib/formats/petiteVue';
import { sfcParser } from '../lib/formats/sfc';
import { vitePressParser } from '../lib/formats/vitepress';
import type { VueFormatBlock } from '../lib/types';

function tags(content: string, block: VueFormatBlock | undefined) {
	expect(content.slice(block!.offset, block!.offset + block!.content.length)).toBe(block!.content);
	return [
		content.slice(block!.element!.start, block!.offset),
		block!.content,
		content.slice(block!.offset + block!.content.length, block!.element!.end),
	];
}

test('reads the blocks of an SFC at the offsets of the file', () => {
	const content = `<!-- @vue-ignore -->\n<script lang="ts" src="./a.ts"></script>\n`
		+ `<script setup lang="ts" generic="T">const a = 1;</script>\n`
		+ `<template><div/></template>\n<style module="m" scoped>.a {}</style>\n<i18n>{}</i18n>\n`;
	const sfc = sfcParser.parse('/a.vue', content)!;

	expect(sfc.comments).toEqual([' @vue-ignore ']);
	expect(tags(content, sfc.template)).toEqual(['<template>', '<div/>', '</template>']);
	expect(tags(content, sfc.script)).toEqual(['<script lang="ts" src="./a.ts">', '', '</script>']);
	expect(tags(content, sfc.scriptSetup)).toEqual([
		'<script setup lang="ts" generic="T">',
		'const a = 1;',
		'</script>',
	]);
	expect(tags(content, sfc.styles[0])).toEqual(['<style module="m" scoped>', '.a {}', '</style>']);
	expect(tags(content, sfc.customBlocks[0])).toEqual(['<i18n>', '{}', '</i18n>']);
	expect(sfc.script!.src).toEqual({ text: './a.ts', offset: content.indexOf('./a.ts') });
	expect(sfc.scriptSetup!.generic).toEqual({ text: 'T', offset: content.indexOf('T">') });
	expect(sfc.styles[0]).toMatchObject({ module: { text: 'm', offset: content.indexOf('m"') }, scoped: true });
	expect(sfc.customBlocks[0]!.type).toBe('i18n');
	expect(sfc.vapor).toBe(false);
});

test.each([
	['<script setup vapor></script>', true],
	['<script vapor></script>', true],
	['<template vapor></template>', true],
	['<script vapor></script><script setup></script>', true],
	['<script setup></script><script setup vapor></script>', false],
	['<script vapor="false"></script>', true],
	['<style vapor></style><i18n vapor></i18n>', false],
])('reads whether the SFC %s is a Vapor component', (content, vapor) => {
	expect(sfcParser.parse('/a.vue', content)!.vapor).toBe(vapor);
});

test('reads no Vapor component in a petite-vue page', () => {
	expect(petiteVueParser.parse('/a.html', '<script vapor></script>')!.vapor).toBeUndefined();
});

test('updates the blocks that an edit changes and keeps the others', () => {
	const content = `<template><div/></template>\n<script setup generic="T">const a = 1;</script>\n`
		+ `<style src="./a.css"></style>\n`;
	const sfc = sfcParser.parse('/a.vue', content)!;
	const snapshot = structuredClone(sfc);
	const start = content.indexOf('1;');
	const updated = sfcParser.update!(sfc, { start, end: start + 1, newText: '123' })!;
	const newContent = content.slice(0, start) + '123' + content.slice(start + 1);

	expect(updated).toEqual(sfcParser.parse('/a.vue', newContent));
	expect(sfc).toEqual(snapshot);
	expect(updated.template).toBe(sfc.template);
	expect(updated.scriptSetup).not.toBe(sfc.scriptSetup);
	expect(updated.styles[0]).not.toBe(sfc.styles[0]);
	expect(sfcParser.update!(sfc, { start, end: start + 1, newText: '1' })).toBe(sfc);
});

test('leaves the errors in the content of the template of an SFC to the template compiler', () => {
	const content = `<template><div></template>\n<style>`;
	const errors = sfcParser.parse('/a.vue', content)!.errors;

	expect(errors.map(error => [error.code, error.loc!.start.offset])).toEqual([
		[CompilerDOM.ErrorCodes.X_MISSING_END_TAG, content.indexOf('<style>')],
	]);
});

test('parses an SFC again on the edit after a parse with errors, those in the template included', () => {
	const content = `<template><div></template>\n<script setup>const a = 1;</script>\n`;
	const sfc = sfcParser.parse('/a.vue', content)!;
	const start = content.indexOf('1;');

	expect(sfc.errors).toEqual([]);
	expect(sfcParser.update!(sfc, { start, end: start + 1, newText: '2' })).toBeUndefined();
});

test('reads a VitePress file as a template over the file and its blocks at the offsets of the file', () => {
	const content =
		`# {{ title }}\n\n<script setup lang="ts">\nconst title = 1;\n</script>\n\n<style scoped>a {}</style>\n`;
	const sfc = vitePressParser.parse('/a.md', content)!;

	expect(sfc.template).toMatchObject({ offset: 0 });
	expect(sfc.template!.element).toBeUndefined();
	expect(sfc.template!.content).toHaveLength(content.length);
	expect(sfc.template!.content.slice(0, 13)).toBe('# {{ title }}');
	expect(sfc.template!.content).not.toContain('const title');
	expect(tags(content, sfc.scriptSetup)).toEqual(['<script setup lang="ts">', '\nconst title = 1;\n', '</script>']);
	expect(tags(content, sfc.styles[0])).toEqual(['<style scoped>', 'a {}', '</style>']);
	expect(sfc.styles[0]!.scoped).toBe(true);
});

test('reads a petite-vue page as a template over the file and its blocks at the offsets of the file', () => {
	const content = `<div v-scope>{{ a }}</div>\n<script type="module">const a = 1;</script>\n<style></style>\n`;
	const sfc = petiteVueParser.parse('/a.html', content)!;

	expect(sfc.template).toMatchObject({ offset: 0 });
	expect(sfc.template!.element).toBeUndefined();
	expect(sfc.template!.content).toHaveLength(content.length);
	expect(tags(content, sfc.scriptSetup)).toEqual(['<script type="module">', 'const a = 1;', '</script>']);
	expect(tags(content, sfc.styles[0])).toEqual(['<style>', '', '</style>']);
});
