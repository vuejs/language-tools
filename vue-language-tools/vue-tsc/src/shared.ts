import type { _Program } from './index';

export const state: {
	lastTscProgramCallback?: {
		program: _Program,
		index: number,
		worker: Promise<any>,
	};
} = {};
