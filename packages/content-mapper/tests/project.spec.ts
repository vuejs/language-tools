import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect, test } from 'vitest';
import { closeProject, openProject, transformVue } from '../project';
import { SpanMapFeature } from '../protocol';

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
	expect(opened.watchedFiles).toContain(
		path.resolve(__dirname, '../../../test-workspace/tsconfig.base.json'),
	);

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
			skipTemplateCodegen: true,
			target: 99,
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

test('applies mapper options on top of the tsconfig options', () => {
	const configFileName = path.resolve(__dirname, '../../../test-workspace/content-mapper/tsconfig.json');
	const fileName = path.resolve(__dirname, '../../../test-workspace/content-mapper/App.vue');
	const content = `<template><div /></template>`;

	openProject({ configFileName, projectHandle: 'baseline-project', compilerOptions: {}, options: {} });
	const baseline = transformVue({ projectHandle: 'baseline-project', fileName, content }).text;
	closeProject('baseline-project');

	const opened = openProject({
		configFileName,
		projectHandle: 'configured-project',
		compilerOptions: {},
		options: { skipTemplateCodegen: true },
	});
	const result = transformVue({ projectHandle: 'configured-project', fileName, content }).text;
	closeProject('configured-project');

	expect(result.length).toBeLessThan(baseline.length);
	expect(opened.optionDiagnostics).toEqual([]);
});

test('reports invalid mapper options', () => {
	const opened = openProject({
		configFileName: path.resolve(__dirname, '../../../test-workspace/content-mapper/tsconfig.json'),
		projectHandle: 'invalid-options-project',
		compilerOptions: {},
		options: { strictTemplates: true, typo: 1 },
	});
	closeProject('invalid-options-project');

	expect(opened.optionDiagnostics).toEqual([
		expect.objectContaining({ path: ['strictTemplates'] }),
		expect.objectContaining({ path: ['typo'] }),
	]);
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
		});
		expect(result.extension).toBe(extension);
	}
});

test('maps the synthetic default export to the top of the SFC', () => {
	const projectHandle = 'export-anchor-project';
	openProject({
		configFileName: '',
		projectHandle,
		compilerOptions: {},
	});

	const result = transformVue({
		projectHandle,
		fileName: path.resolve(__dirname, 'Anchor.vue'),
		content: `<script setup lang="ts">const msg = 'hi';</script>\n<template>{{ msg }}</template>\n`,
	});
	closeProject(projectHandle);

	const exportStart = result.text.indexOf('export default');
	expect(exportStart).toBeGreaterThanOrEqual(0);
	const anchor = result.mappings.find(mapping => mapping[0] === exportStart && mapping[1] === 0);
	expect(anchor).toBeDefined();
	expect(anchor![2]).toBe(0);
	expect(anchor![3]).toBe(0);
	expect(anchor![5] & SpanMapFeature.Definition).toBeTruthy();
	expect(anchor![5] & SpanMapFeature.Rename).toBeFalsy();
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
		messageText: "Unused '@vue-expect-error' directive.",
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

/**
 * Creates a throwaway workspace with an installed Vue version and a Vue language plugin, so that
 * `target: 'auto'` and `plugins` resolution have something to resolve from the project root.
 */
function createWorkspace() {
	const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'vue-content-mapper-')));
	const pluginDir = path.join(workspace, 'node_modules/vue-test-plugin');
	fs.mkdirSync(path.join(workspace, 'node_modules/vue'), { recursive: true });
	fs.mkdirSync(pluginDir, { recursive: true });
	fs.writeFileSync(
		path.join(workspace, 'node_modules/vue/package.json'),
		JSON.stringify({ name: 'vue', version: '3.5.0' }),
	);
	fs.writeFileSync(
		path.join(pluginDir, 'package.json'),
		JSON.stringify({ name: 'vue-test-plugin', version: '1.0.0', main: 'index.js' }),
	);
	fs.writeFileSync(pluginEntry(workspace), `module.exports = () => ({ name: 'vue-test-plugin', version: 2 });\n`);
	return workspace;
}

function pluginEntry(workspace: string) {
	return path.join(workspace, 'node_modules/vue-test-plugin/index.js');
}

test('tracks dynamic configuration for inferred projects', () => {
	const workspace = createWorkspace();
	const configFileName = '';
	const options = { target: 'auto', plugins: ['vue-test-plugin'] };
	const previousCwd = process.cwd();
	try {
		process.chdir(workspace);
		const openInferredProject = (projectHandle: string) =>
			openProject({ configFileName, projectHandle, compilerOptions: {}, options });

		const first = openInferredProject('inferred-project');
		closeProject('inferred-project');
		const vueManifest = path.join(workspace, 'node_modules/vue/package.json');
		expect(first.watchedFiles).toContain(vueManifest);
		expect(first.watchedFiles).toContain(pluginEntry(workspace));

		fs.writeFileSync(vueManifest, JSON.stringify({ name: 'vue', version: '3.6.0' }));
		const withNewerVue = openInferredProject('inferred-project');
		closeProject('inferred-project');
		expect(withNewerVue.configIdentity).not.toBe(first.configIdentity);

		fs.writeFileSync(
			pluginEntry(workspace),
			`module.exports = () => ({ name: 'vue-test-plugin', version: 2, order: 3 });\n`,
		);
		const withNewerPlugin = openInferredProject('inferred-project');
		closeProject('inferred-project');
		expect(withNewerPlugin.configIdentity).not.toBe(withNewerVue.configIdentity);
	}
	finally {
		process.chdir(previousCwd);
		fs.rmSync(workspace, { recursive: true, force: true });
	}
});

test('watches plugins declared in the tsconfig vueCompilerOptions', () => {
	const workspace = createWorkspace();
	const configFileName = path.join(workspace, 'tsconfig.json');
	fs.writeFileSync(
		configFileName,
		JSON.stringify({
			compilerOptions: { strict: true },
			vueCompilerOptions: { plugins: ['vue-test-plugin'] },
		}),
	);
	try {
		const first = openProject({
			configFileName,
			projectHandle: 'tsconfig-plugin-project',
			compilerOptions: {},
			options: {},
		});
		closeProject('tsconfig-plugin-project');
		expect(first.watchedFiles).toContain(pluginEntry(workspace));

		fs.writeFileSync(
			pluginEntry(workspace),
			`module.exports = () => ({ name: 'vue-test-plugin', version: 2, order: 3 });\n`,
		);
		const second = openProject({
			configFileName,
			projectHandle: 'tsconfig-plugin-project',
			compilerOptions: {},
			options: {},
		});
		closeProject('tsconfig-plugin-project');
		expect(second.configIdentity).not.toBe(first.configIdentity);
	}
	finally {
		fs.rmSync(workspace, { recursive: true, force: true });
	}
});

test('watches plugins declared in the mapper entry options', () => {
	const workspace = createWorkspace();
	const configFileName = path.join(workspace, 'tsconfig.json');
	fs.writeFileSync(configFileName, JSON.stringify({ compilerOptions: { strict: true } }));
	try {
		const opened = openProject({
			configFileName,
			projectHandle: 'mapper-plugin-project',
			compilerOptions: {},
			options: { plugins: ['vue-test-plugin'] },
		});
		closeProject('mapper-plugin-project');
		expect(opened.watchedFiles).toContain(pluginEntry(workspace));
	}
	finally {
		fs.rmSync(workspace, { recursive: true, force: true });
	}
});
