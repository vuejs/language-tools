import * as path from 'path';
import * as fs from 'fs';
import { describe, it } from 'vitest';
import { fork } from 'child_process';

const binPath = require.resolve('../bin/vue-tsc.js');
const workspace = path.resolve(__dirname, '../../vue-test-workspace/vue-tsc');

function prettyPath(path: string, isRoot: boolean) {
	const segments = path.split('/');
	return !isRoot ? segments.slice(segments.length - 2, segments.length).join('/') : segments[segments.length - 1];
}

function collectTests(dir: string, depth = 2, isRoot: boolean = true): [string, boolean][] {
	const tests: [string, boolean][] = [];

	if (depth <= 0) {
		return tests;
	}

	const files = fs.readdirSync(dir);
	for (const file of files) {
		const filePath = path.join(dir, file);
		const stat = fs.statSync(filePath);
		if (stat.isDirectory()) {
			const tsconfigPath = path.join(filePath, 'tsconfig.json');
			if (fs.existsSync(tsconfigPath)) {
				tests.push([
					filePath.replace(/\\/g, '/'),
					isRoot,
				]);
			}
			tests.push(...collectTests(filePath, depth - 1, false));
		}
	}

	return tests;
}

const tests = collectTests(workspace);

function runVueTsc(cwd: string) {
	return new Promise((resolve, reject) => {
		const cp = fork(
			binPath,
			['--noEmit'],
			{
				silent: true,
				cwd
			},
		);

		cp.stdout?.setEncoding('utf8');
		cp.stdout?.on('data', (data) => {
			console.log(data);
		});
		cp.stderr?.setEncoding('utf8');
		cp.stderr?.on('data', (data) => {
			console.error(data);
		});

		cp.on('exit', (code) => {
			if (code === 0) {
				resolve(undefined);
			} else {
				reject(new Error(`Exited with code ${code}`));
			}
		});
	});
}

describe(`vue-tsc`, () => {
	for (const [path, isRoot] of tests) {
		it(`vue-tsc no errors (${prettyPath(path, isRoot)})`, () => runVueTsc(path), 40_000);
	}
});
