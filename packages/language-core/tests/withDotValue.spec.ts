import * as ts from 'typescript';
import { expect, test } from 'vitest';
import { createLanguage, createVueLanguagePlugin, forEachEmbeddedCode, getDefaultCompilerOptions } from '../index';

function generate(source: string) {
	const language = createLanguage<string>(
		[createVueLanguagePlugin<string>(ts, {}, getDefaultCompilerOptions(), fileName => fileName)],
		new Map(),
		() => {},
	);
	const root = language.scripts.set('/Comp.vue', ts.ScriptSnapshot.fromString(source), 'vue')!.generated!.root;
	const script = [...forEachEmbeddedCode(root)].find(code => code.id === 'script_ts')!;
	return script.snapshot.getText(0, script.snapshot.getLength());
}

function generateTemplateAssertions(source: string) {
	const text = generate(source);
	return text.slice(text.indexOf('__VLS_withDotValue('), text.indexOf('// @ts-ignore\n['));
}

test('functions in the template re-assert the imports and mutable bindings they read', () => {
	expect(generateTemplateAssertions(`<script setup lang="ts">
import { SOME_CONST } from './constants';
const rows = ['a'];
let count = 1;
</script>

<template>
	<div v-if="count" />
	{{ rows.map(row => row.length) }}
	{{ rows.map(() => SOME_CONST.A) }}
	<button @click="() => {}" />
	<button @click="() => { rows.map(function () { return count.toFixed(); }) }" />
</template>
`)).toMatchInlineSnapshot(`
  "__VLS_withDotValue(count, {} as import('vue').Ref<unknown>);
  __VLS_withDotValue(rows, {} as import('vue').Ref<unknown>);
  __VLS_withDotValue(SOME_CONST, {} as import('vue').Ref<unknown>);
  if (count.value) {
  __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
  });
  }
  ( rows.value.map(row => row.length) );
  ( rows.value.map(() => {
  __VLS_withDotValue(SOME_CONST, {} as import('vue').Ref<unknown>);
  return (SOME_CONST.value.A);
  }) );
  __VLS_asFunctionalElement1(__VLS_intrinsics.button)({
  ...{ onClick: (() => {})},
  });
  __VLS_asFunctionalElement1(__VLS_intrinsics.button)({
  ...{ onClick: (() => { rows.value.map(function () {
  __VLS_withDotValue(count, {} as import('vue').Ref<unknown>);
   return count.value.toFixed(); }) })},
  });
  "
`);
});
