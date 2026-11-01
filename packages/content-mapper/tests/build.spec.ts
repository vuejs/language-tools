import * as path from 'node:path';
import { expect, test } from 'vitest';
import { repositoryRoot, runTsc } from './utils';

test('content mapper --build', () => {
	const result = runTsc([
		'-b',
		path.join(repositoryRoot, 'test-workspace/tscBuild'),
		'--runExternalCode',
		'--pretty',
		'false',
	]);
	expect(result.status, result.stdout + result.stderr).toBe(0);
});
