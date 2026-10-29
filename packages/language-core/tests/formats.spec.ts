import { expect, test } from 'vitest';
import { petiteVueParser } from '../lib/formats/petiteVue';
import { sfcParser } from '../lib/formats/sfc';
import { vitePressParser } from '../lib/formats/vitepress';
import type { VueFormatBlock } from '../lib/types';

function tags(content: string, block: VueFormatBlock | undefined) {
	return block && [
		content.slice(block.start, block.startTagEnd),
		content.slice(block.startTagEnd, block.endTagStart),
		content.slice(block.endTagStart, block.end),
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
});

test('shifts the offsets of the blocks after an edit', () => {
	const content = `<script setup generic="T">const a = 1;</script>\n<style src="./a.css"></style>\n`;
	const sfc = sfcParser.parse('/a.vue', content)!;
	const start = content.indexOf('1;');
	const updated = sfcParser.update!(sfc, { start, end: start + 1, newText: '123' })!;
	const newContent = content.slice(0, start) + '123' + content.slice(start + 1);

	expect(updated).toEqual(sfcParser.parse('/a.vue', newContent));
});

test('reads a VitePress file as a template without tags and its blocks at the offsets of the file', () => {
	const content =
		`# {{ title }}\n\n<script setup lang="ts">\nconst title = 1;\n</script>\n\n<style scoped>a {}</style>\n`;
	const sfc = vitePressParser.parse('/a.md', content)!;

	expect(sfc.template).toMatchObject({ start: 0, startTagEnd: 0, endTagStart: content.length, end: content.length });
	expect(sfc.template!.content.slice(0, 13)).toBe('# {{ title }}');
	expect(sfc.template!.content).not.toContain('const title');
	expect(tags(content, sfc.scriptSetup)).toEqual(['<script setup lang="ts">', '\nconst title = 1;\n', '</script>']);
	expect(tags(content, sfc.styles[0])).toEqual(['<style scoped>', 'a {}', '</style>']);
	expect(sfc.styles[0]!.scoped).toBe(true);
});

test('reads a petite-vue page as a template without tags and its blocks at the offsets of the file', () => {
	const content = `<div v-scope>{{ a }}</div>\n<script type="module">const a = 1;</script>\n<style></style>\n`;
	const sfc = petiteVueParser.parse('/a.html', content)!;

	expect(sfc.template).toMatchObject({ start: 0, startTagEnd: 0, endTagStart: content.length, end: content.length });
	expect(tags(content, sfc.scriptSetup)).toEqual(['<script type="module">', 'const a = 1;', '</script>']);
	expect(tags(content, sfc.styles[0])).toEqual(['<style>', '', '</style>']);
});
