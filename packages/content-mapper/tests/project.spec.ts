import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, test } from 'vitest';
import { closeProject, openProject, transformVue } from '../project';

test('generates a Vue service script with source mappings', () => {
	const projectHandle = 'test-project';
	const configFileName = path.resolve(__dirname, '../../../test-workspace/content-mapper/tsconfig.json');
	const opened = openProject({
		configFileName,
		projectHandle,
		compilerOptions: { strict: true },
	});

	expect(opened.configIdentity).toHaveLength(64);
	expect(opened.watchedFiles).toContain(configFileName);

	const result = transformVue({
		projectHandle,
		fileName: path.resolve(__dirname, 'App.vue'),
		content: `<script setup lang="ts">
const count: number = 'wrong';
</script>

<template>{{ count.toFixed() }}</template>
`,
	});
	closeProject(projectHandle);

	expect(result.text).toContain('count');
	expect(result.text).toContain('toFixed');
	expect(result.extension).toBe('.ts');
	expect(result.mappings.length).toBeGreaterThan(0);
	for (let index = 1; index < result.mappings.length; index++) {
		const previous = result.mappings[index - 1]!;
		const current = result.mappings[index]!;
		expect(previous[0] + previous[1]).toBeLessThanOrEqual(current[0]);
	}
});

test('uses stable mapper options for inferred projects', () => {
	const projectHandle = 'inferred-project';
	openProject({
		configFileName: '',
		projectHandle,
		compilerOptions: { strict: true },
		options: {
			vueCompilerOptions: {
				skipTemplateCodegen: true,
				target: 99,
			},
		},
	});

	const result = transformVue({
		projectHandle,
		fileName: path.resolve(__dirname, '../../../test-workspace/content-mapper/App.vue'),
		content: `<script setup lang="ts">const value = 1;</script>
<template>{{ templateValue }}</template>`,
	});
	closeProject(projectHandle);

	expect(result.text).not.toContain('templateValue');
});

test('returns a parser-compatible service script extension', () => {
	for (
		const [lang, extension] of [
			['js', '.js'],
			['jsx', '.jsx'],
			['ts', '.ts'],
			['tsx', '.tsx'],
		] as const
	) {
		const result = transformVue({
			fileName: path.resolve(__dirname, `ServiceScript.${lang}.vue`),
			content: `<script lang="${lang}">export default {};</script>`,
			compilerOptions: {},
		});
		expect(result.extension).toBe(extension);
	}
});

test('maps Vue diagnostic directives to virtual regions', () => {
	const projectHandle = 'directive-project';
	const configFileName = path.resolve(
		__dirname,
		'../../../test-workspace/tsc/_failed_directives/tsconfig.json',
	);
	const fileName = path.resolve(
		__dirname,
		'../../../test-workspace/tsc/_failed_directives/main.vue',
	);
	const content = fs.readFileSync(fileName, 'utf8');
	openProject({
		configFileName,
		projectHandle,
		compilerOptions: { strict: true },
	});

	const result = transformVue({
		projectHandle,
		fileName,
		content,
	});
	closeProject(projectHandle);

	const diagnosticDirectives = result.diagnosticDirectives!;
	expect(diagnosticDirectives.unusedExpectDirectiveDiagnostics).toEqual([{
		code: 2578,
		messageText: "Unused '@ts-expect-error' directive.",
	}]);
	expect(diagnosticDirectives.directives.filter(directive => directive[4] === 1)).toHaveLength(2);
	expect(diagnosticDirectives.directives.filter(directive => directive[4] === 0).length).toBeGreaterThan(2);
	for (const directive of diagnosticDirectives.directives) {
		expect(directive[3] - directive[2]).toBeGreaterThan(0);
		if (directive[4] === 1) {
			expect(content.slice(
				directive[0],
				directive[0] + directive[1],
			)).toContain('@vue-expect-error');
		}
	}
});
