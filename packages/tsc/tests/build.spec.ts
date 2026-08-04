import * as path from 'node:path';
import { expect, test } from 'vitest';
import { run } from '..';

test(`vue-tsc --build`, () => {
	expect(runTsc).not.toThrow();
});

function runTsc() {
	const originalConsoleLog = process.stdout.write;
	const originalArgv = process.argv;
	const originalExit = process.exit;
	process.stdout.write = () => true;
	process.argv = [
		...originalArgv,
		'--build',
		path.resolve(__dirname, '../../../test-workspace/tscBuild'),
		'--pretty',
		'false',
	];
	process.exit = (() => {}) as typeof process.exit;
	try {
		const tscPath = require.resolve(
			`typescript/lib/tsc`,
			{ paths: [path.resolve(__dirname, '../../../test-workspace')] },
		);
		run(tscPath);
	}
	finally {
		process.stdout.write = originalConsoleLog;
		process.argv = originalArgv;
		process.exit = originalExit;
	}
}
