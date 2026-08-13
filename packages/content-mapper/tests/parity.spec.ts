import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, test } from 'vitest';

const repositoryRoot = path.resolve(__dirname, '../../..');
const tsgoPath = process.env.TSGO_PATH;

test.skipIf(!tsgoPath || !fs.existsSync(tsgoPath))(
	'tsc content mapper matches vue-tsc diagnostics',
	() => {
		for (
			const configFileName of [
				path.join(repositoryRoot, 'test-workspace/content-mapper/tsconfig.json'),
				path.join(repositoryRoot, 'test-workspace/content-mapper-pug/tsconfig.json'),
				path.join(repositoryRoot, 'test-workspace/content-mapper-directives/tsconfig.json'),
			]
		) {
			const tsgo = run(tsgoPath!, [
				'-p',
				configFileName,
				'--loadExternalPlugins',
				'--pretty',
				'false',
			]);
			const vueTsc = run(process.execPath, [
				path.join(repositoryRoot, 'packages/tsc/bin/vue-tsc.js'),
				'-p',
				configFileName,
				'--pretty',
				'false',
			]);

			expect(normalizeDiagnostics(tsgo), configFileName).toBe(normalizeDiagnostics(vueTsc));
		}

		function normalizeDiagnostics(output: string) {
			return output
				.replace(/error vue(\d+):/g, 'error TS$1:')
				.split('\n')
				.sort()
				.join('\n');
		}
	},
);

function run(command: string, args: string[]) {
	const result = spawnSync(command, args, {
		cwd: repositoryRoot,
		encoding: 'utf8',
		env: {
			...process.env,
			VUE_CONTENT_MAPPER_WORKERS: '2',
		},
	});
	return (result.stdout + result.stderr)
		.replace(/^.*TNB ACTIVE.*\n/gm, '')
		.trim();
}
