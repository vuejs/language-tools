import * as path from 'path';
import { describe, it } from 'vitest';
import { fork } from 'child_process';

const binPath = require.resolve('../bin/vue-tsc.js');

describe(`vue-tsc`, () => {
	it(`vue-tsc no errors`, () => new Promise((resolve, reject) => {
		const cp = fork(
			binPath,
			['--noEmit'],
			{
				silent: true,
				cwd: path.resolve(__dirname, '../../vue-test-workspace/vue-tsc')
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
	}), 40_000);
});


describe(`vue-tsc vue 2`, () => {
	it(`vue-tsc no errors`, () => new Promise((resolve, reject) => {
		const cp = fork(
			binPath,
			['--noEmit'],
			{
				silent: true,
				cwd: path.resolve(__dirname, '../../vue2-test-workspace/vue-tsc')
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
	}), 40_000);
});
