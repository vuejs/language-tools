import {
	createVuePlugins,
	createVueSource,
	getDefaultCompilerOptions,
	resolveCodeOffsets,
	type VueCompilerOptions,
	type VueSource,
} from '@vue/language-core';
import { loadTypeScript } from '@vue/language-core/lib/typescript';
import { toString } from 'muggle-string';
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { buildMappings } from '../lib/buildMappings';
import { generateServiceScript } from '../lib/codegen';

export const repositoryRoot = path.resolve(__dirname, '../../..');

const compilerArgs = [path.join(repositoryRoot, 'node_modules/typescript-7/bin/tsc')];

function spawnCompiler(args: string[]) {
	return spawnSync(process.execPath, [...compilerArgs, ...args], {
		cwd: repositoryRoot,
		encoding: 'utf8',
		env: {
			...process.env,
			VUE_CONTENT_MAPPER_WORKERS: '2',
		},
	});
}

export function runTsc(args: string[]) {
	return spawnCompiler(args);
}

export function normalizeCompilerOutput(output: { stdout: string; stderr: string }) {
	return (output.stdout + output.stderr)
		.replace(/^.*TNB ACTIVE.*\n/gm, '')
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
		createVuePlugins(ts, vueCompilerOptions),
		fileName,
		createSnapshot(content),
	);
}

/** The service script of `source`, with its segments at file offsets. */
export function generateFromSource(source: VueSource) {
	const { lang, codes } = generateServiceScript(loadTypeScript(), source.fileName, source.ir, source.analysis);
	const resolved = resolveCodeOffsets(source.ir, codes);
	return {
		lang,
		text: toString(resolved),
		mappings: buildMappings(resolved),
	};
}

export function generate(fileName: string, content: string, vueCompilerOptions?: VueCompilerOptions) {
	return generateFromSource(createSource(fileName, content, vueCompilerOptions));
}
