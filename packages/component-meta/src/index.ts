import * as ts from 'typescript';
import { createCheckerByJsonBase, createCheckerBase } from './base';
import type { MetaCheckerOptions } from './types';

export * from './types';

export function createCheckerByJson(
	rootPath: string,
	json: any,
	checkerOptions: MetaCheckerOptions = {},
) {
	return createCheckerByJsonBase(
		ts as any,
		rootPath,
		json,
		checkerOptions,
	);
}

export function createChecker(
	tsconfig: string,
	checkerOptions: MetaCheckerOptions = {},
) {
	return createCheckerBase(
		ts as any,
		tsconfig,
		checkerOptions,
	);
}
