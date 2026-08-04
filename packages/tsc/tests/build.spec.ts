import { expect, test } from 'vitest';
import { runTsc } from './utils';

test(`vue-tsc --build`, () => {
	expect(() => runTsc('tscBuild')).not.toThrow();
});
