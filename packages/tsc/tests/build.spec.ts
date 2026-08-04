import * as path from 'node:path';
import { expect, test } from 'vitest';
import { run } from '..';
import { runTsc } from './utils';

test(`vue-tsc --build`, () => {
	expect(() => runTsc('tscBuild')).not.toThrow();
});
