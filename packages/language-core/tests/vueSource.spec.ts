import { expect, test } from 'vitest';
import { getDefaultCompilerOptions } from '../lib/compilerOptions';
import { createVueEmbeddedCodePlugins, createVueLanguagePlugin, createVuePlugins } from '../lib/languagePlugin';
import { createVueSource } from '../lib/vueSource';
import { createSnapshot, ts } from './typescript';

const fileName = '/project/src/Comp.vue';
const before = '<script setup lang="ts">const before = 1;</script>\n<template>{{ before }}</template>\n';
const after = '<script setup lang="ts">const after = 1;</script>\n<template>{{ after }}</template>\n';

function createSource(content: string, vueCompilerOptions = getDefaultCompilerOptions()) {
	return createVueSource(
		ts,
		vueCompilerOptions,
		createVuePlugins(ts, vueCompilerOptions),
		fileName,
		createSnapshot(content),
	);
}

test('a source keeps its IR and analysis across updates', () => {
	const source = createSource(before);
	const { ir, analysis } = source;
	expect([...analysis.getSetupBindings()]).toEqual(['before']);

	source.update(createSnapshot(after));
	expect(source.ir).toBe(ir);
	expect(source.analysis).toBe(analysis);
	expect(ir.scriptSetup?.content).toContain('after');
	expect([...analysis.getSetupBindings()]).toEqual(['after']);
});

test('each source owns the analysis of its options', () => {
	const vaporOptions = { ...getDefaultCompilerOptions(), vapor: true };
	const plain = createSource(before);
	const vapor = createSource(before, vaporOptions);
	expect(vapor.analysis).not.toBe(plain.analysis);
	expect(plain.analysis.getIsVapor()).toBe(false);
	expect(vapor.analysis.getIsVapor()).toBe(true);
});

test('the virtual code of the language service reads its source', () => {
	const plugin = createVueLanguagePlugin<string>(ts, getDefaultCompilerOptions(), id => id);
	const code = plugin.createVirtualCode!(fileName, 'vue', createSnapshot(before), {} as never)!;
	expect(code.ir).toBe(code.source.ir);
	expect(code.scriptAnalysis).toBe(code.source.analysis);

	plugin.updateVirtualCode!(fileName, code, createSnapshot(after), {} as never);
	expect(code.source.snapshot.getText(0, code.source.snapshot.getLength())).toBe(after);
	expect([...code.scriptAnalysis.getSetupBindings()]).toEqual(['after']);
});

test('the IR plugins and the embedded-code plugins are separate', () => {
	const vueCompilerOptions = getDefaultCompilerOptions();
	const irPlugins = createVuePlugins(ts, vueCompilerOptions);
	const embeddedCodePlugins = createVueEmbeddedCodePlugins(ts, vueCompilerOptions);

	expect(irPlugins.some(plugin => 'getEmbeddedCodes' in plugin || 'resolveEmbeddedCode' in plugin)).toBe(false);
	expect(irPlugins.filter(plugin => plugin.compileSFCScript)).toHaveLength(1);
	expect(irPlugins.filter(plugin => plugin.compileSFCTemplate)).toHaveLength(1);
	expect(irPlugins.filter(plugin => plugin.compileSFCStyle)).toHaveLength(1);
	expect(embeddedCodePlugins.every(plugin => plugin.getEmbeddedCodes && plugin.resolveEmbeddedCode)).toBe(true);
	expect(
		embeddedCodePlugins.some(plugin =>
			plugin.parseSFC || plugin.updateSFC || plugin.resolveTemplateCompilerOptions || plugin.compileSFCScript
			|| plugin.compileSFCTemplate || plugin.compileSFCStyle || plugin.updateSFCTemplate
		),
	).toBe(false);

	const source = createVueSource(ts, vueCompilerOptions, irPlugins, fileName, createSnapshot(before));
	expect(source.ir.template?.ast).toBeDefined();
	expect([...source.analysis.getSetupBindings()]).toEqual(['before']);
});
