import * as path from 'node:path';
import { expect, test } from 'vitest';
import { normalizeCompilerOutput, repositoryRoot, runTsc, supportsRunExternalCode } from './utils';

const configFileNames = [
	'test-workspace/content-mapper/tsconfig.json',
	'test-workspace/content-mapper-pug/tsconfig.json',
	'test-workspace/content-mapper-directives/tsconfig.json',
];

test.skipIf(!supportsRunExternalCode())('content mapper fixtures', () => {
	for (const configFileName of configFileNames) {
		const result = runTsc([
			'-p',
			path.join(repositoryRoot, configFileName),
			'--runExternalCode',
			'--pretty',
			'false',
		]);
		expect(normalizeCompilerOutput(result)).toMatchSnapshot(configFileName);
	}
});
