import { createCheckerBase } from './lib/checker';
import type { MetaCheckerOptions } from './lib/types';

export * from './lib/types';

export async function createChecker(
	tsconfig: string,
	checkerOptions: MetaCheckerOptions = {},
) {
	const ts = {
		...await import('typescript-7/ast'),
		...await import('typescript-7/async'),
	};
	return createCheckerBase(ts, tsconfig, checkerOptions);
}
