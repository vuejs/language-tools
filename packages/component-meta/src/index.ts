import * as ts from 'typescript';
import { createCheckerByJsonConfigBase, createCheckerBase } from './base';
import type { MetaCheckerOptions } from './types';

export * from './types';

export function createComponentMetaCheckerByJsonConfig(
	rootPath: string,
	json: any,
	checkerOptions: MetaCheckerOptions = {},
) {
	return createCheckerByJsonConfigBase(
		ts,
		rootPath,
		json,
		checkerOptions,
	);
}

export function createComponentMetaChecker(
	tsconfig: string,
	checkerOptions: MetaCheckerOptions = {},
) {
	return createCheckerBase(
		ts,
		tsconfig,
		checkerOptions,
	);
}
