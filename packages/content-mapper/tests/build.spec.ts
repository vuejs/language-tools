import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, test } from 'vitest';
import { repositoryRoot, runTsc } from './utils';

test('content mapper --build', () => {
	const result = runTsc([
		'-b',
		path.join(repositoryRoot, 'test-workspace/tscBuild'),
		'--runExternalCode',
		'--pretty',
		'false',
	]);
	expect(result.status, result.stdout + result.stderr).toBe(0);
});

test('type checks ordinary script default exports through the content mapper', () => {
	const workspace = fs.mkdtempSync(path.join(repositoryRoot, 'test-workspace', '.default-export-'));
	try {
		fs.writeFileSync(
			path.join(workspace, 'tsconfig.json'),
			JSON.stringify({
				compilerOptions: { module: 'esnext', moduleResolution: 'bundler', strict: true, noEmit: true },
				contentMappers: [{ package: '@vue/content-mapper', extensions: ['.vue'] }],
				include: ['*.vue'],
			}),
		);
		fs.writeFileSync(
			path.join(workspace, 'Empty.vue'),
			'<script lang="ts">\nexport default {};\n</script>\n',
		);
		fs.writeFileSync(
			path.join(workspace, 'WithProps.vue'),
			`<script lang="ts">
import { defineComponent } from 'vue';
export default defineComponent({
	props: { label: { type: String, required: true } },
});
</script>
<template>{{ label.toUpperCase() }}</template>
`,
		);
		const result = runTsc(['-p', path.join(workspace, 'tsconfig.json'), '--runExternalCode', '--pretty', 'false']);
		expect(result.status, result.stdout + result.stderr).toBe(0);
	}
	finally {
		fs.rmSync(workspace, { recursive: true, force: true });
	}
});
