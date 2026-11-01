import { expect, test } from 'vitest';
import { createIRPipeline } from '../lib/ir/irPipeline';
import { createVueSource } from '../lib/ir/vueSource';
import { getDefaultCompilerOptions } from '../lib/options/compilerOptions';
import { createSnapshot, ts } from './typescript';

const fileName = '/project/src/Comp.vue';
const before = '<script setup lang="ts">const before = 1;</script>\n<template>{{ before }}</template>\n';
const after = '<script setup lang="ts">const after = 1;</script>\n<template>{{ after }}</template>\n';

function createSource(content: string, vueCompilerOptions = getDefaultCompilerOptions()) {
	return createVueSource(
		ts,
		vueCompilerOptions,
		createIRPipeline(ts, vueCompilerOptions),
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

test('a source is in Vapor mode by the `vapor` of its format', () => {
	expect(createSource('<script setup vapor></script>').analysis.getIsVapor()).toBe(true);
	expect(createSource('<template vapor></template>').analysis.getIsVapor()).toBe(true);
	expect(createSource(before).analysis.getIsVapor()).toBe(false);
});

test('the IR pipeline compiles each kind of block with its built-in compiler', () => {
	const pipeline = createIRPipeline(ts, getDefaultCompilerOptions());

	expect(pipeline.parse(fileName, before)?.result.scriptSetup?.content).toBe('const before = 1;');
	expect(pipeline.compileTemplate('html', '<div></div>', {})?.result.ast.children).toHaveLength(1);
	expect(pipeline.compileTemplate('pug', 'div', {})).toBeUndefined();
	expect(pipeline.compileScript('ts', 'let a;')?.statements).toHaveLength(1);
	expect(pipeline.compileScript('coffee', 'a = 1')).toBeUndefined();
	const style = '.a { color: v-bind(b); }';
	expect(pipeline.compileStyle('scss', style)).toEqual({
		bindings: [{ text: 'b', offset: style.indexOf('b)') }],
		classNames: [{ text: '.a', offset: 0 }],
	});
});
