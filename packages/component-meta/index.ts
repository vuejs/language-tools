import * as ts from 'typescript';
import { createCheckerBase, createCheckerByJsonConfigBase } from './lib/base';
import type { MetaCheckerOptions } from './lib/types';

export * from './lib/types';

export function createCheckerByJson(
	rootPath: string,
	json: any,
	checkerOptions: MetaCheckerOptions = {}
) {
	return createCheckerByJsonConfigBase(
		ts,
		rootPath,
		json,
		checkerOptions
	);
}

export function createChecker(
	tsconfig: string,
	checkerOptions: MetaCheckerOptions = {}
) {
	return createCheckerBase(
		ts,
		tsconfig,
		checkerOptions
	);
}
