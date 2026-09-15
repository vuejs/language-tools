import { proxyCreateProgram } from '@volar/typescript';
import * as core from '@vue/language-core';
import { getLocalTypesGenerator } from '@vue/language-core/lib/codegen/localTypes';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import { beforeAll, expect, test } from 'vitest';

const workspace = path.resolve(__dirname, '../../../test-workspace/tsc/slot-children');
const normalize = (file: string) => file.replace(/\\/g, '/');
const messages = (diagnostics: readonly ts.Diagnostic[]) =>
	diagnostics.map(d =>
		`${d.file ? path.basename(d.file.fileName) : ''}: ${d.code}: ${
			ts.flattenDiagnosticMessageText(d.messageText, '\n')
		}`
	);
const options: ts.CompilerOptions = {
	strict: true,
	allowJs: true,
	skipLibCheck: true,
	noEmit: true,
	allowNonTsExtensions: true,
	jsx: ts.JsxEmit.Preserve,
	target: ts.ScriptTarget.ESNext,
	module: ts.ModuleKind.ESNext,
	moduleResolution: ts.ModuleResolutionKind.Bundler,
};

function createProgram(
	files: string[],
	overlay = new Map<string, string>(),
	vueOptions: Partial<core.VueCompilerOptions> = { strictSlotChildren: true },
	compilerOptions = options,
) {
	const host = ts.createCompilerHost(compilerOptions);
	const { readFile, fileExists } = host;
	host.readFile = file => overlay.get(normalize(file)) ?? readFile(file);
	host.fileExists = file => overlay.has(normalize(file)) || fileExists(file);
	const directories = new Set([...overlay.keys()].map(file => normalize(path.dirname(file))));
	host.directoryExists = dir => directories.has(normalize(dir)) || ts.sys.directoryExists(dir);
	const create = proxyCreateProgram(ts, ts.createProgram, ts => [
		core.createVueLanguagePlugin(ts, compilerOptions, {
			...core.getDefaultCompilerOptions(),
			...vueOptions,
		}, id => id),
	]);
	return create({ host, rootNames: files, options: compilerOptions });
}

const fixtures = [
	'main.vue',
	'advanced.vue',
	'forwarding.vue',
	'imports.vue',
	'namespaces.vue',
	'unions.vue',
	'conditional.vue',
	'declared.vue',
].map(name => {
	const file = normalize(path.join(workspace, name));
	const source = fs.readFileSync(file, 'utf8');
	const expectedLines = source.split('\n').flatMap((line, index) =>
		line.includes('@vue-expect-error') ? [index + 2] : []
	);
	return { name, file, source, expectedLines };
});
const files = fixtures.map(({ file }) => file);
const overlay = new Map(
	fixtures.map(({ file, source }) => [file, source.replaceAll('@vue-expect-error', 'unsuppressed')]),
);
let checked: readonly ts.Diagnostic[];
let unsuppressed: readonly ts.Diagnostic[];
let unchecked: readonly ts.Diagnostic[];

beforeAll(() => {
	checked = ts.getPreEmitDiagnostics(createProgram(files));
	unsuppressed = ts.getPreEmitDiagnostics(createProgram(files, overlay));
	unchecked = ts.getPreEmitDiagnostics(createProgram(files, overlay, {}));
});

for (const { name, file, expectedLines } of fixtures) {
	const forFile = (diagnostics: readonly ts.Diagnostic[]) =>
		diagnostics.filter(diagnostic =>
			!diagnostic.file || !files.includes(normalize(diagnostic.file.fileName))
			|| normalize(diagnostic.file.fileName) === file
		);

	test(`slot children: ${name} accepts valid cases and consumes every expected error`, () => {
		expect(messages(forFile(checked))).toEqual([]);
	});

	test(`slot children: ${name} reports slot assignment errors at the exact source ranges`, () => {
		expect(
			forFile(unsuppressed).map(diagnostic => ({
				file: normalize(diagnostic.file!.fileName),
				line: diagnostic.file!.text.slice(0, diagnostic.start).split('\n').length,
				code: diagnostic.code,
				start: diagnostic.file!.text.slice(diagnostic.start, diagnostic.start! + 1),
			})),
		).toEqual(expectedLines.map(line => ({ file, line, code: 2322, start: '<' })));
	});

	test(`slot children: ${name} remains unchecked without the explicit opt-in`, () => {
		expect(messages(forFile(unchecked))).toEqual([]);
	});
}

test('slot children: native roots do not emit component or forwarding helpers', () => {
	const localTypes = getLocalTypesGenerator(core.getDefaultCompilerOptions());
	expect([...localTypes.generate()]).toEqual([]);
	const name = localTypes.SlotElement;
	expect(localTypes.SlotElement).toBe(name);
	const code = [...localTypes.generate()].join('');
	const file = ts.createSourceFile('helpers.ts', code, ts.ScriptTarget.Latest, true);
	expect(
		file.statements.map(statement =>
			ts.isTypeAliasDeclaration(statement) ? ts.unescapeLeadingUnderscores(statement.name.escapedText) : undefined
		),
	)
		.toEqual([name]);
	expect([...localTypes.generate()]).toEqual([]);
});

test('slot children: local helper dependencies type-check with a custom Vue library', () => {
	const localTypes = getLocalTypesGenerator({ ...core.getDefaultCompilerOptions(), lib: 'custom-vue' });
	const check = localTypes.SlotChildrenCheck;
	const missing = localTypes.MissingSlotChildren;
	const provider = localTypes.SlotProvider;
	const element = localTypes.SlotElement;
	const code = [...localTypes.generate()].join('');
	const source = ts.createSourceFile('helpers.ts', code, ts.ScriptTarget.Latest, true);
	const names = source.statements.map(statement =>
		ts.isTypeAliasDeclaration(statement) ? ts.unescapeLeadingUnderscores(statement.name.escapedText) : undefined
	);
	expect(new Set(names).size).toBe(names.length);
	expect(code).toContain("import('custom-vue').VNode");
	expect(code).not.toContain("import('vue')");

	const file = normalize(path.join(workspace, 'local-helpers.ts'));
	const library = normalize(path.join(workspace, 'custom-vue.ts'));
	const text = code + `
const children: ${check}<[{ element: ${element}<'input', 0> }], () => import('custom-vue').VNode[]> = [];
const slots: ${missing}<{ slots: { default(): HTMLInputElement } }, ${provider}<'default', [HTMLInputElement]>> = [];
export { children, slots };
`;
	const overlay = new Map([[file, text], [library, "export * from 'vue';"]]);
	const host = ts.createCompilerHost(options);
	const { readFile, fileExists } = host;
	host.readFile = file => overlay.get(normalize(file)) ?? readFile(file);
	host.fileExists = file => overlay.has(normalize(file)) || fileExists(file);
	const program = ts.createProgram({
		host,
		rootNames: [file],
		options: { ...options, skipLibCheck: false, paths: { 'custom-vue': [library] } },
	});
	expect(messages(ts.getPreEmitDiagnostics(program))).toEqual([]);
});

test('slot children: strictTemplates does not enable the experimental option', () => {
	const resolved = core.createParsedCommandLineByJson(ts, ts.sys, workspace, {
		vueCompilerOptions: { strictTemplates: true },
	});
	expect(resolved.vueOptions.strictSlotChildren).toBe(false);
});

test('slot children: declaration consumers retain imported types, generics and wrapper roots', () => {
	const output = normalize(path.join(workspace, '__declarations'));
	const files = fs.readdirSync(workspace).filter(file => /\.(vue|ts)$/.test(file))
		.map(file => path.join(workspace, file));
	const program = createProgram(files, undefined, undefined, {
		...options,
		noEmit: false,
		declaration: true,
		emitDeclarationOnly: true,
		rootDir: workspace,
		outDir: output,
	});
	expect(messages(ts.getPreEmitDiagnostics(program))).toEqual([]);
	const emitted = new Map<string, string>();
	const result = program.emit(undefined, (file, text) => emitted.set(normalize(file), text));
	expect(result.emitSkipped).toBe(false);
	expect(messages(result.diagnostics)).toEqual([]);
	expect(emitted.size).toBe(files.length);

	// Do not provide Volar's ambient helpers to a plain TypeScript consumer.
	const host = ts.createCompilerHost(options);
	const { readFile, fileExists } = host;
	host.readFile = file => emitted.get(normalize(file)) ?? readFile(file);
	host.fileExists = file => emitted.has(normalize(file)) || fileExists(file);
	host.directoryExists = dir => normalize(dir) === output || ts.sys.directoryExists(dir);
	const consumer = ts.createProgram({
		host,
		rootNames: [...emitted.keys()],
		options: { ...options, skipLibCheck: false },
	});
	expect(messages(ts.getPreEmitDiagnostics(consumer))).toEqual([]);

	const file = normalize(path.join(workspace, 'declaration-consumer.vue'));
	emitted.set(
		file,
		`<script setup lang="ts">
import Basic from './__declarations/Basic.vue';
import Wrapper from './__declarations/Wrapper.vue';
import PairWrapper from './__declarations/PairWrapper.vue';
import Recursive from './__declarations/Recursive.vue';
import UnionHolder from './__declarations/UnionHolder.vue';
import Item from './__declarations/Item.vue';
import Other from './__declarations/Other.vue';
</script>
<template>
  <Basic>
    <Wrapper :value="1" />
    <PairWrapper />
  </Basic>
  <Basic>
    <Wrapper value="wrong" />
  </Basic>
  <Basic>
    <Recursive :depth="3" />
  </Basic>
  <UnionHolder>
    <Item :value="1" />
    <Other other="yes" />
  </UnionHolder>
  <UnionHolder>
    <Item value="wrong" />
  </UnionHolder>
</template>`,
	);
	const diagnostics = ts.getPreEmitDiagnostics(createProgram([file], emitted));
	expect(diagnostics.map(
		d => [normalize(d.file!.fileName), d.file!.text.slice(0, d.start).split('\n').length, d.code],
	)).toEqual([15, 18, 25].map(line => [file, line, 2322]));
});

test('slot children: wrapper chains are not limited to an arbitrary depth', () => {
	const overlay = new Map<string, string>();
	let previous = 'PairWrapper';
	for (let index = 0; index < 24; index++) {
		const name = `DeepWrapper${index}`;
		overlay.set(
			normalize(path.join(workspace, `${name}.vue`)),
			`<script setup lang="ts">
import Child from './${previous}.vue';
</script>
<template>
  <Child />
</template>`,
		);
		previous = name;
	}
	const file = normalize(path.join(workspace, 'deep-consumer.vue'));
	overlay.set(
		file,
		`<script setup lang="ts">
import Basic from './Basic.vue';
import Deep from './${previous}.vue';
</script>
<template>
  <Basic>
    <template #pair>
      <Deep />
    </template>
  </Basic>
</template>`,
	);
	expect(messages(ts.getPreEmitDiagnostics(createProgram([file], overlay)))).toEqual([]);
});
