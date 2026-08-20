import { spawnSync } from 'node:child_process';
import * as path from 'node:path';

export const repositoryRoot = path.resolve(__dirname, '../../..');

const tscScript = path.join(repositoryRoot, 'node_modules/typescript-7/bin/tsc');

export function runTsc(args: string[]) {
	return spawnSync(process.execPath, [tscScript, ...args], {
		cwd: repositoryRoot,
		encoding: 'utf8',
		env: {
			...process.env,
			VUE_CONTENT_MAPPER_WORKERS: '2',
		},
	});
}

export function supportsRunExternalCode() {
	const result = spawnSync(process.execPath, [tscScript, '--help'], { encoding: 'utf8' });
	return (result.stdout + result.stderr).includes('runExternalCode');
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
