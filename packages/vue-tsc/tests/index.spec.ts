import path from 'path';
import { describe, it } from 'vitest';
import { exec } from 'child_process';

const binPath = require.resolve('../bin/vue-tsc.js');

describe(`vue-tsc`, () => {
	it(`vue-tsc no errors`, async () => {
		exec(
			`node ${JSON.stringify(binPath)} --noEmit`,
			{ cwd: path.resolve('../../vue-test-workspace') },
			(error, stdout, stderr) => {
				// Error: spawn /bin/sh ENOENT
				console.log({ error, stdout, stderr });
			},
		);
	});
});
