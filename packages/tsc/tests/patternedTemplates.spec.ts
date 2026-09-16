import { proxyCreateProgram } from '@volar/typescript';
import * as core from '@vue/language-core';
import * as path from 'node:path';
import * as ts from 'typescript';
import { describe, expect, test } from 'vitest';

const cases: [string, string, string[], boolean][] = [
	['literal union', "'a' | 'b'", ["'a'", "'b'"], true],
	['missing literal', "'a' | 'b' | 'c'", ["'a'", "'b'"], false],
	['boolean', 'boolean', ['true', 'false'], true],
	['missing false', 'boolean', ['true'], false],
	['nullable', "'a' | null | undefined", ["'a'", 'null', 'undefined'], true],
	['undefined is distinct', "'a' | null | undefined", ["'a'", 'null'], false],
	['open string', 'string', ["'a'", "'b'"], false],
	['open number', 'number', ['1', '2'], false],
	['open string needs catch-all', 'string', ['{}'], false],
	['open number needs catch-all', 'number', ['{}'], false],
	['any requires fallback', 'any', ['{}', '[...]', 'true', 'false', 'null', 'undefined'], false],
	['unknown requires fallback', 'unknown', ['{}', '[...]', 'null', 'undefined'], false],
	['unknown fallback', 'unknown', ['_'], true],
	['any binding fallback', 'any', ['const value'], true],
	['never', 'never', [], true],
	['or union', "'a' | 'b' | 'c'", ["('a' | 'b') as ab", "'c'"], true],
	['guard does not cover', "'a' | 'b'", ["'a' if (true)", "'b'"], false],
	['complementary guards', 'boolean', ['_ if (subject)', '_ if (!subject)'], false],
	['guarded wildcard', 'unknown', ['_ if (true)'], false],
	['unguarded after guard', 'boolean', ['true if (true)', 'true', 'false'], true],
	['tags', "{ kind: 'ok'; data: string } | { kind: 'error'; error: Error }", [
		"{ kind: 'ok', const data }",
		"{ kind: 'error', const error }",
	], true],
	['partial tag', "{ kind: 'ok'; data: string | null } | { kind: 'error' }", [
		"{ kind: 'ok', data: null }",
		"{ kind: 'error' }",
	], false],
	['nested object product', "{ x: 'a' | 'b'; nested: { y: true | false } }", [
		"{ x: 'a', nested: { y: true } }",
		"{ x: 'a', nested: { y: false } }",
		"{ x: 'b' }",
	], true],
	['missing object product', "{ x: 'a' | 'b'; nested: { y: true | false } }", [
		"{ x: 'a', nested: { y: true } }",
		"{ x: 'b' }",
	], false],
	['optional absent', "{ x?: 'a' }", ["{ x: 'a' }", '{ x: undefined }'], false],
	['optional present wildcard', "{ x?: 'a' }", ['{ x: _ }'], false],
	['optional empty object', "{ x?: 'a' }", ['{}'], true],
	['open objects', '{ x: 1; y: 2 }', ['{ x: 1 }'], true],
	['object rest does not constrain', '{ x: 1; y: number }', ['{ x: 1, ...const rest }'], true],
	['tuple product', "['left' | 'right', 'top' | 'bottom']", [
		"['left', 'top']",
		"['left', 'bottom']",
		"['right', 'top']",
		"['right', 'bottom']",
	], true],
	['missing tuple product', "['left' | 'right', 'top' | 'bottom']", [
		"['left', 'top']",
		"['left', 'bottom']",
		"['right', 'top']",
	], false],
	['tuple with rest', '[string, number, boolean]', ['[const first, ...const tail]'], true],
	['array partition', 'string[]', ['[]', '[const first, ...const tail]'], true],
	['array missing long', 'string[]', ['[]', '[const first]'], false],
	['all arrays', 'readonly string[]', ['[...const items]'], true],
	['nullable array', 'string[] | null', ['[...]'], false],
	['array boolean head', 'boolean[]', ['[]', '[true, ...]', '[false, ...]'], true],
	['array missing head', 'boolean[]', ['[]', '[true, ...]'], false],
	['tuple optional', '[string?]', ['[]', '[const value]'], true],
	['tuple optional missing', '[string?]', ['[]'], false],
];

const workspace = path.resolve(__dirname, '../../../test-workspace/patterned-templates').replace(/\\/g, '/');
const sources = new Map<string, string>();
for (const [index, [, type, arms]] of cases.entries()) {
	sources.set(
		`${workspace}/${index}.vue`,
		`<script setup lang="ts">\ndefineProps<{ subject: ${type} }>();\n</script>\n<template>\n<template v-match="subject">\n${
			arms.map(pattern => `<template v-when="${pattern.replaceAll('"', '&quot;')}"></template>`).join('\n')
		}\n</template>\n</template>`,
	);
}
sources.set(
	`${workspace}/narrowing.vue`,
	`<script setup lang="ts">
defineProps<{ subject: { kind: 'ok'; data: string } | { kind: 'error'; error: Error } }>();
</script>
<template><template v-match="subject">
<div v-when="{ kind: 'ok', const data } as success" :title="data.toUpperCase()" @click="subject.data.toUpperCase()">
{{ subject.data.toUpperCase() }} {{ success.data.toUpperCase() }}
<!-- @vue-expect-error -->
{{ subject.error }}
<!-- @vue-expect-error -->
{{ data.toFixed() }}
<!-- @vue-expect-error -->
{{ data = 'mutated' }}
</div>
<div v-when="{ kind: 'error', const error }">{{ subject.error.message }} {{ error.message }}</div>
</template>
<!-- @vue-expect-error -->
{{ data }}
</template>`,
);
sources.set(
	`${workspace}/values.vue`,
	`<script setup lang="ts">
enum Status { A = 'a', B = 'b' }
const A = 'a' as const;
defineProps<{ subject: Status; unionValue: Status }>();
</script>
<template>
<template v-match="subject"><i v-when="Status.A"/><i v-when="Status.B"/></template>
<!-- @vue-expect-error -->
<template v-match="subject"><i v-when="unionValue"/></template>
</template>`,
);

sources.set(
	`${workspace}/rest.vue`,
	`<script setup lang="ts">
import { exactType } from '../tsc/shared';
defineProps<{ tuple: readonly [string, number, boolean]; list: readonly string[]; result: { kind: 'ok'; data: string; extra: number } | { kind: 'error'; error: Error } }>();
</script><template>
<template v-match="tuple"><i v-when="[const first, ...const tail] as tupleWhole">
{{ exactType(tupleWhole, {} as readonly [string, number, boolean]) }}
{{ exactType(first, {} as string) }} {{ exactType(tail, {} as [number, boolean]) }}
{{ tail.push(1) }}
</i></template>
<template v-match="list"><i v-when="[]"/><i v-when="[const first, ...const tail] if (tail.length)">
{{ exactType(first, {} as string) }} {{ exactType(tail, {} as string[]) }} {{ tail.push('x') }}
</i><i v-when="[const first, ...]"/></template>
<template v-match="result"><i v-when="{ kind: 'ok', const data, ...const rest } as success">
{{ exactType(data, {} as string) }} {{ exactType(rest, {} as { extra: number }) }}
{{ exactType(success, {} as { kind: 'ok'; data: string; extra: number }) }}
<!-- @vue-expect-error -->
{{ rest.kind }}
</i><i v-when="{ kind: 'error', const error }">{{ exactType(error, {} as Error) }}</i></template>
</template>`,
);

sources.set(
	`${workspace}/imported.ts`,
	`export type Result<T> = { kind: 'ok'; data: T } | { kind: 'error'; error: Error };`,
);
sources.set(
	`${workspace}/generics.vue`,
	`<script setup lang="ts" generic="T extends { id: string }">
import type { Result } from './imported';
import { exactType } from '../tsc/shared';
defineProps<{ result: Result<T>; open: T }>();
</script><template>
<template v-match="result"><div v-when="{ kind: 'ok', const data }">{{ exactType(data, {} as T) }} {{ data.id }}</div><i v-when="{ kind: 'error', const error }">{{ error.message }}</i></template>
<template v-match="open"><i v-when="const value">{{ exactType(value, {} as T) }}</i></template>
</template>`,
);

sources.set(
	`${workspace}/nested.vue`,
	`<script setup lang="ts">
import { ref } from 'vue';
import type { Result } from './imported';
const result = ref<Result<{ x: 'a' | 'b' }>>();
</script><template>
<template v-match="result"><div v-when="{ kind: 'ok', const data }"><template v-match="data.x"><i v-when="'a'"/><i v-when="'b'"/></template></div><i v-when="{ kind: 'error' }"/><i v-when="undefined"/></template>
</template>`,
);

sources.set(
	`${workspace}/unknown-narrowing.vue`,
	`<script setup lang="ts">
import { exactType } from '../tsc/shared';
defineProps<{ subject: unknown; optional: { x?: string }; open: { kind: 'ok' } }>();
</script><template>
<template v-match="subject"><i v-when="{ value: const value }">{{ exactType(value, {} as unknown) }}</i><i v-when="_"/></template>
<template v-match="optional"><i v-when="{ const x }">{{ exactType(x, {} as string | undefined) }}</i><i v-when="_"/></template>
<template v-match="subject"><i v-when="[const first, ...]">{{ exactType(first, {} as unknown) }}</i><i v-when="_"/></template>
<template v-match="open"><i v-when="{ extra: const extra }">{{ exactType(extra, {} as unknown) }}</i><i v-when="_"/></template>
</template>`,
);
sources.set(
	`${workspace}/invalid.vue`,
	`<script setup lang="ts">defineProps<{ subject: boolean }>()</script><template><template v-match="subject"><i v-when="let value"/><i v-when="_"/></template></template>`,
);

sources.set(
	`${workspace}/javascript.vue`,
	`<script setup>
// @ts-check
import { ref } from 'vue';
const subject = ref(true);
</script><template><template v-match="subject"><i v-when="true"/><i v-when="false"/></template></template>`,
);

sources.set(
	`${workspace}/javascript-missing.vue`,
	sources.get(`${workspace}/javascript.vue`)!.replace('<i v-when="false"/>', ''),
);

const options: ts.CompilerOptions = {
	allowJs: true,
	checkJs: true,
	strict: true,
	noEmit: true,
	skipLibCheck: true,
	allowNonTsExtensions: true,
	target: ts.ScriptTarget.ESNext,
	module: ts.ModuleKind.ESNext,
	moduleResolution: ts.ModuleResolutionKind.Bundler,
	jsx: ts.JsxEmit.Preserve,
	types: [],
};
const host = ts.createCompilerHost(options);
const directoryExists = host.directoryExists?.bind(host);
host.directoryExists = dir => dir.replace(/\\/g, '/') === workspace || !!directoryExists?.(dir);
const readFile = host.readFile.bind(host);
const fileExists = host.fileExists.bind(host);
host.readFile = file => sources.get(file.replace(/\\/g, '/')) ?? readFile(file);
host.fileExists = file => sources.has(file.replace(/\\/g, '/')) || fileExists(file);
const createProgram = proxyCreateProgram(ts, ts.createProgram, (ts, options) => {
	const vueOptions = core.createParsedCommandLineByJson(ts, ts.sys, workspace, {}).vueOptions;
	return [core.createVueLanguagePlugin(ts, options.options, vueOptions, id => id)];
});
const program = createProgram({ rootNames: [...sources.keys()], options, host });

describe('RFC 823 required coverage', () => {
	test('inferred JavaScript template types require coverage', () => {
		const file = program.getSourceFile(`${workspace}/javascript-missing.vue`)!;
		const diagnostics = program.getSemanticDiagnostics(file);
		expect(diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([
			expect.stringContaining('Non-exhaustive v-match'),
		]);
	});

	test('invalid pattern is a vue-tsc error', () => {
		const file = program.getSourceFile(`${workspace}/invalid.vue`)!;
		const diagnostics = program.getSemanticDiagnostics(file);
		expect(diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([
			expect.stringContaining('Only const pattern bindings'),
		]);
	});

	for (const [index, [name, , , exhaustive]] of cases.entries()) {
		test(name, () => {
			const fileName = `${workspace}/${index}.vue`;
			const file = program.getSourceFile(fileName)!;
			const diagnostics = [...program.getSyntacticDiagnostics(file), ...program.getSemanticDiagnostics(file)];
			const messages = diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
			expect(messages, name).toHaveLength(exhaustive ? 0 : 1);
			if (!exhaustive) {
				expect(messages[0]).toContain('Non-exhaustive v-match');
				if (name === 'missing tuple product') {
					expect(messages[0]?.replaceAll('\\"', '"')).toContain(`v-when="['right', 'bottom']"`);
				}
				if (name === 'missing literal') {
					expect(messages[0]?.replaceAll('\\"', '"')).toContain('v-when="\'c\'"');
				}
				expect(sources.get(fileName)!.slice(diagnostics[0]!.start, diagnostics[0]!.start! + diagnostics[0]!.length!))
					.toBe('subject');
			}
		});
	}
	for (const name of ['narrowing', 'values', 'rest', 'generics', 'nested', 'unknown-narrowing', 'javascript']) {
		test(name, () => {
			const file = program.getSourceFile(`${workspace}/${name}.vue`)!;
			expect(
				[...program.getSyntacticDiagnostics(file), ...program.getSemanticDiagnostics(file)].map(d =>
					ts.flattenDiagnosticMessageText(d.messageText, '\n')
				),
			).toEqual([]);
		});
	}
});
