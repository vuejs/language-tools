import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect, test } from 'vitest';
import { getUnusedExpectErrorMessage } from '../localization';
import { closeProject, openProject, transformVue } from '../project';
import { DiagnosticDirectivePolicy, SpanMapFeature } from '../protocol';

test('generates a Vue service script with source mappings', () => {
	const projectHandle = 'test-project';
	const configFileName = path.resolve(__dirname, '../../../test-workspace/content-mapper/tsconfig.json');
	const opened = openProject({
		configFileName,
		projectHandle,
		compilerOptions: { strict: true },
	});

	expect(opened.configIdentity).toHaveLength(64);
	expect(opened.watchedFiles).not.toContain(configFileName);
	expect(opened.watchedFiles).not.toContain(
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
			lib: 'custom-vue',
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

	expect(result.text).toContain(`'custom-vue'`);
});

test('generates the template code although the removed skipTemplateCodegen option is set', () => {
	const projectHandle = 'skip-template-codegen-project';
	const opened = openProject({
		configFileName: '',
		projectHandle,
		compilerOptions: {},
		options: { skipTemplateCodegen: true },
	});
	const result = transformVue({
		projectHandle,
		fileName: path.resolve(__dirname, 'SkipTemplateCodegen.vue'),
		content: `<script setup lang="ts">const value = 1;</script>\n<template>{{ templateValue }}</template>\n`,
	});
	closeProject(projectHandle);

	expect(result.text).toContain('templateValue');
	expect(opened.optionDiagnostics).toMatchObject([{ path: ['skipTemplateCodegen'] }]);
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
		options: { lib: 'custom-vue' },
	});
	const result = transformVue({ projectHandle: 'configured-project', fileName, content }).text;
	closeProject('configured-project');

	expect(baseline).not.toContain(`'custom-vue'`);
	expect(result).toContain(`'custom-vue'`);
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
	const projectHandle = 'service-script-project';
	openProject({
		configFileName: path.resolve(__dirname, '../../../test-workspace/content-mapper/tsconfig.json'),
		projectHandle,
		compilerOptions: {},
	});
	for (
		const [lang, extension] of [
			['js', '.js'],
			['jsx', '.jsx'],
			['ts', '.ts'],
			['tsx', '.tsx'],
		] as const
	) {
		const result = transformVue({
			projectHandle,
			fileName: path.resolve(__dirname, `ServiceScript.${lang}.vue`),
			content: `<script lang="${lang}">export default {};</script>`,
		});
		expect(result.extension).toBe(extension);
	}
	closeProject(projectHandle);
});

test('rejects a transform outside an open project', () => {
	expect(() =>
		transformVue({
			projectHandle: 'unknown-project',
			fileName: path.resolve(__dirname, 'App.vue'),
			content: '',
		})
	).toThrow('Unknown Vue content mapper project handle: unknown-project');
});

test('parses a file by its entry format, not by its extension', () => {
	const projectHandle = 'format-project';
	openProject({
		configFileName: path.resolve(__dirname, '../../../test-workspace/content-mapper/tsconfig.json'),
		projectHandle,
		options: { format: 'vitepress' },
		compilerOptions: {},
	});
	const content = '# {{ title }}\n\n<script setup lang="ts">\nconst title = 1;\n</script>\n';
	const result = transformVue({ projectHandle, fileName: path.resolve(__dirname, 'Page.vue'), content });
	closeProject(projectHandle);

	// The interpolation in the markdown body is template only to the VitePress parser.
	const interpolationStart = content.indexOf('title');
	expect(result.mappings.some(([, , originalStart]) => originalStart === interpolationStart)).toBe(true);
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
	const exportEnd = result.text.indexOf(';', exportStart) + 1;
	const anchor = result.mappings.find(mapping => mapping[0] === exportStart);
	expect(anchor).toBeDefined();
	expect(anchor![1]).toBe(exportEnd - exportStart);
	expect(anchor![2]).toBe(0);
	expect(anchor![3]).toBe(0);
	expect(anchor![5] & SpanMapFeature.Definition).toBeTruthy();
	expect(anchor![5] & SpanMapFeature.Rename).toBeFalsy();
});

test('maps document highlights on tag names like any other reference', () => {
	const projectHandle = 'tag-highlight-project';
	openProject({
		configFileName: '',
		projectHandle,
		compilerOptions: {},
	});

	const content = `<script setup lang="ts">import Comp from './Comp.vue';\nconst msg = 'hi';</script>\n`
		+ `<template><div><Comp /></div><Comp></Comp><my-el></my-el>{{ msg }}</template>\n`;
	const result = transformVue({
		projectHandle,
		fileName: path.resolve(__dirname, 'TagHighlight.vue'),
		content,
	});
	closeProject(projectHandle);

	const highlightable = (offset: number) =>
		result.mappings.some(([, , originalStart, originalLength, , features]) =>
			offset >= originalStart && offset < originalStart + originalLength
			&& (features & SpanMapFeature.DocumentHighlights) !== 0
		);
	for (const tag of ['<div', '</div', '<Comp', '</Comp', '<my-el', '</my-el']) {
		let offset = content.indexOf(tag);
		while (offset !== -1) {
			expect(highlightable(offset + tag.indexOf('<') + (tag[1] === '/' ? 2 : 1)), tag).toBe(true);
			offset = content.indexOf(tag, offset + 1);
		}
	}
	expect(highlightable(content.lastIndexOf('msg'))).toBe(true);
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
		messageText: getUnusedExpectErrorMessage(),
	}]);
	expect(diagnosticDirectives.directives.filter(directive => directive[4] === DiagnosticDirectivePolicy.Expect))
		.toHaveLength(2);
	expect(diagnosticDirectives.directives.filter(directive => directive[4] === DiagnosticDirectivePolicy.Ignore).length)
		.toBeGreaterThan(2);
	for (const directive of diagnosticDirectives.directives) {
		expect(directive[3] - directive[2]).toBeGreaterThan(0);
		if (directive[4] === DiagnosticDirectivePolicy.Expect) {
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
	fs.writeFileSync(pluginEntry(workspace), `exports.ir = {};\n`);
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
			`exports.ir = { templateCompilers: {} };\n`,
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

test('ignores the top-level vueCompilerOptions of the tsconfig', () => {
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
		const opened = openProject({
			configFileName,
			projectHandle: 'tsconfig-plugin-project',
			compilerOptions: {},
			options: {},
		});
		closeProject('tsconfig-plugin-project');
		expect(opened.watchedFiles).not.toContain(pluginEntry(workspace));
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

test('generates the service script without the embedded code hooks of plugins', () => {
	const workspace = createWorkspace();
	const configFileName = path.join(workspace, 'tsconfig.json');
	fs.writeFileSync(configFileName, JSON.stringify({ compilerOptions: { strict: true } }));
	fs.writeFileSync(
		pluginEntry(workspace),
		`module.exports = {
	ir: {},
	getEmbeddedCodes: () => [{ id: 'script_ts', lang: 'ts' }],
	resolveEmbeddedCode(_fileName, _ir, embeddedFile) {
		embeddedFile.content.push('/* from vue-test-plugin */');
	},
};\n`,
	);
	try {
		openProject({
			configFileName,
			projectHandle: 'embedded-code-plugin-project',
			compilerOptions: {},
			options: { plugins: ['vue-test-plugin'] },
		});
		const result = transformVue({
			projectHandle: 'embedded-code-plugin-project',
			fileName: path.join(workspace, 'App.vue'),
			content: `<script setup lang="ts">const msg = '';</script>\n<template>{{ msg }}</template>\n`,
		});
		closeProject('embedded-code-plugin-project');
		expect(result.text).toContain('msg');
		expect(result.text).not.toContain('vue-test-plugin');
	}
	finally {
		fs.rmSync(workspace, { recursive: true, force: true });
	}
});

test('propagates an exception thrown by the codegen instead of returning an empty service script', () => {
	const projectHandle = 'codegen-exception-project';
	openProject({
		configFileName: '',
		projectHandle,
		compilerOptions: {},
		// not an array, so the codegen of an object literal default export throws on reading it
		options: { optionsWrapper: null },
	});
	try {
		expect(() =>
			transformVue({
				projectHandle,
				fileName: path.resolve(__dirname, 'CodegenException.vue'),
				content: `<script lang="ts">export default {};</script>\n`,
			})
		).toThrow(TypeError);
	}
	finally {
		closeProject(projectHandle);
	}
});

test('propagates an exception thrown by the contribute of a codegen plugin', () => {
	const workspace = createWorkspace();
	const configFileName = path.join(workspace, 'tsconfig.json');
	fs.writeFileSync(configFileName, JSON.stringify({ compilerOptions: { strict: true } }));
	fs.writeFileSync(
		pluginEntry(workspace),
		`exports.codegen = { contribute() { throw new Error('contribute failed'); } };\n`,
	);
	try {
		openProject({
			configFileName,
			projectHandle: 'contribute-exception-project',
			compilerOptions: {},
			options: { plugins: ['vue-test-plugin'] },
		});
		expect(() =>
			transformVue({
				projectHandle: 'contribute-exception-project',
				fileName: path.join(workspace, 'App.vue'),
				content: `<script setup lang="ts">const msg = '';</script>\n`,
			})
		).toThrow('contribute failed');
	}
	finally {
		closeProject('contribute-exception-project');
		fs.rmSync(workspace, { recursive: true, force: true });
	}
});

test('reuses the transform result of a file whose content did not change', () => {
	const fileName = path.resolve(__dirname, 'Unchanged.vue');
	const content = `<script setup lang="ts">const msg = '';</script>\n<template>{{ msg }}</template>\n`;
	openProject({ configFileName: '', projectHandle: 'unchanged-project', compilerOptions: {} });
	const first = transformVue({ projectHandle: 'unchanged-project', fileName, content });
	const second = transformVue({ projectHandle: 'unchanged-project', fileName, content });
	const changed = transformVue({ projectHandle: 'unchanged-project', fileName, content: content + '\n' });
	closeProject('unchanged-project');
	expect(second).toBe(first);
	expect(changed).not.toBe(first);
});

test('transforms a changed file of an open project as a newly opened project does', () => {
	const fileName = path.resolve(__dirname, 'Changed.vue');
	const before = `<script setup lang="ts">const before = 1;</script>\n<template>{{ before }}</template>\n`;
	const after = `<script setup lang="ts">const after = '';</script>\n<template><div :title="after" /></template>\n`;

	openProject({ configFileName: '', projectHandle: 'changed-project', compilerOptions: {} });
	transformVue({ projectHandle: 'changed-project', fileName, content: before });
	const changed = transformVue({ projectHandle: 'changed-project', fileName, content: after });
	closeProject('changed-project');

	openProject({ configFileName: '', projectHandle: 'fresh-project', compilerOptions: {} });
	const fresh = transformVue({ projectHandle: 'fresh-project', fileName, content: after });
	closeProject('fresh-project');

	expect(changed.text).not.toContain('before');
	expect(changed).toEqual(fresh);
});
