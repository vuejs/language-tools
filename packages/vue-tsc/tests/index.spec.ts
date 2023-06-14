import * as path from 'path';
import { describe, it } from 'vitest';
import { fork } from 'child_process';

const binPath = require.resolve('../bin/vue-tsc.js');
const workspace = path.resolve(__dirname, '../../vue-test-workspace/vue-tsc')

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
	})
}

describe(`vue-tsc`, () => {
	it(`vue-tsc no errors (non-strict-template)`, () => runVueTsc(path.resolve(workspace, './non-strict-template')), 40_000);
	it(`vue-tsc no errors (strict-template)`, () => runVueTsc(path.resolve(workspace, './strict-template')), 40_000);
});
