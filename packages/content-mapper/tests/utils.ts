import {
	codeToString,
	createIRPipeline,
	createVueSource,
	getDefaultCompilerOptions,
	resolveCodeOffsets,
	type VueCompilerOptions,
	type VueSource,
} from '@vue/language-core';
import { loadTypeScript } from '@vue/language-core/typescript';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { generateServiceScript } from '../lib/codegen';
import type { CodegenPlugin } from '../lib/codegen/plugin';
import { buildMappings } from '../lib/result/tsCodeMappings';

export const repositoryRoot = path.resolve(__dirname, '../../..');

/** The TS 7.1 installation of the test workspace, which every test runs. */
export const typescriptPackageJsonPath = require.resolve('typescript/package.json', {
	paths: [path.join(repositoryRoot, 'test-workspace')],
});
export const tscPath = path.join(path.dirname(typescriptPackageJsonPath), require(typescriptPackageJsonPath).bin.tsc);

const compilerArgs = [tscPath];

/** Installs the TS 7.1 of the test workspace in `directory`, which projects under it resolve. */
export function linkTypeScript(directory: string) {
	fs.mkdirSync(path.join(directory, 'node_modules'), { recursive: true });
	fs.symlinkSync(
		path.dirname(typescriptPackageJsonPath),
		path.join(directory, 'node_modules/typescript'),
		'junction',
	);
}

function spawnCompiler(args: string[]) {
	return spawnSync(process.execPath, [...compilerArgs, ...args], {
		cwd: repositoryRoot,
		encoding: 'utf8',
	});
}

export function runTsc(args: string[]) {
	return spawnCompiler(args);
}

export function normalizeCompilerOutput(output: { stdout: string; stderr: string }) {
	return (output.stdout + output.stderr)
		.replace(/^.*TNB ACTIVE.*\n/gm, '')
		// module names in messages are absolute
		.replaceAll(repositoryRoot.replaceAll('\\', '/'), '<root>')
		.replace(/\r\n/g, '\n')
		.split('\n')
		.map(line => line.trimEnd())
		.filter(Boolean)
		.sort()
		.join('\n');
}

export function createSnapshot(text: string) {
	return {
		getText: (start: number, end: number) => text.slice(start, end),
		getLength: () => text.length,
		getChangeRange: () => undefined,
	};
}

export function createSource(
	fileName: string,
	content: string,
	vueCompilerOptions: VueCompilerOptions = getDefaultCompilerOptions(),
) {
	const ts = loadTypeScript();
	return createVueSource(
		ts,
		vueCompilerOptions,
		createIRPipeline(ts, vueCompilerOptions),
		fileName,
		createSnapshot(content),
	);
}

/** The service script of `source`, with its segments at file offsets. */
export function generateFromSource(source: VueSource, plugins?: readonly CodegenPlugin[]) {
	const { lang, codes } = generateServiceScript(
		loadTypeScript(),
		source.fileName,
		source.ir,
		source.analysis,
		plugins,
	);
	const resolved = resolveCodeOffsets(source.ir, codes);
	return {
		lang,
		text: codeToString(resolved),
		mappings: buildMappings(resolved),
	};
}

export function generate(
	fileName: string,
	content: string,
	vueCompilerOptions?: VueCompilerOptions,
	plugins?: readonly CodegenPlugin[],
) {
	return generateFromSource(createSource(fileName, content, vueCompilerOptions), plugins);
}
