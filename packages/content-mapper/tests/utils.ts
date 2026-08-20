import { spawnSync } from 'node:child_process';
import * as path from 'node:path';

export const repositoryRoot = path.resolve(__dirname, '../../..');

function compilerCommand() {
	const tsgoPath = process.env.TSGO_PATH;
	if (tsgoPath) {
		return { command: tsgoPath, prefixArgs: [] as string[] };
	}
	return {
		command: process.execPath,
		prefixArgs: [path.join(repositoryRoot, 'node_modules/typescript-7/bin/tsc')],
	};
}

function spawnCompiler(args: string[]) {
	const { command, prefixArgs } = compilerCommand();
	return spawnSync(command, [...prefixArgs, ...args], {
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
