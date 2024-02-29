import * as ts from 'typescript';
import { createCheckerByJsonConfigBase, createCheckerBase } from './base';
import type { MetaCheckerOptions } from './types';

export * from './types';

/**
 * @deprecated Use `createCheckerByJson` instead.
 */
export const createComponentMetaCheckerByJsonConfig = createCheckerByJson;

/**
 * @deprecated Use `createCheckerByJson` instead.
 */
export const createComponentMetaChecker = createChecker;

export function createCheckerByJson(
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

export function createChecker(
	tsconfig: string,
	checkerOptions: MetaCheckerOptions = {},
) {
	return createCheckerBase(
		ts,
		tsconfig,
		checkerOptions,
	);
}
