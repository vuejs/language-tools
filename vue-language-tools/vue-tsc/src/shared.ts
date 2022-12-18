import type { _Program } from './index';

export const state: {
	hook?: {
		program: _Program,
		index: number,
		worker: Promise<any>,
	};
} = {};
