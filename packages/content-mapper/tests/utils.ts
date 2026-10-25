import {
	buildMappings,
	createVueLanguagePlugin,
	getDefaultCompilerOptions,
	resolveCodeOffsets,
	type VueCompilerOptions,
	type VueVirtualCode,
} from '@vue/language-core';
import { loadTypeScript } from '@vue/language-core/lib/typescript';
import { toString } from 'muggle-string';
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
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

export function createVueRoot(
	fileName: string,
	content: string,
	vueCompilerOptions: VueCompilerOptions = getDefaultCompilerOptions(),
) {
	const plugin = createVueLanguagePlugin<string>(loadTypeScript(), vueCompilerOptions, id => id);
	return plugin.createVirtualCode!(fileName, 'vue', createSnapshot(content), {} as any)!;
}

/** The service script of `root`, with its segments at file offsets. */
export function generateFromRoot(root: VueVirtualCode) {
	const { lang, codes } = generateServiceScript(loadTypeScript(), root.fileName, root.ir, root.scriptAnalysis);
	const resolved = resolveCodeOffsets(root.ir, codes);
	return {
		lang,
		text: toString(resolved),
		mappings: buildMappings(resolved),
	};
}

export function generate(fileName: string, content: string, vueCompilerOptions?: VueCompilerOptions) {
	return generateFromRoot(createVueRoot(fileName, content, vueCompilerOptions));
}
