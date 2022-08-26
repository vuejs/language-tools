import { describe, expect, it } from 'vitest';
import { combineMultiLineChangeRanges } from '../out/snapshots';

describe(`Test combineMultiLineChangeRanges()`, () => {

	it(`a`, () => {
		expect(combineMultiLineChangeRanges(
			{ span: { start: 0, length: 0, }, newLength: 1 },
			{ span: { start: 5, length: 0, }, newLength: 1 },
		)).toEqual({ span: { start: 0, length: 5, }, newLength: 7 });
	});

	it(`b`, () => {
		expect(combineMultiLineChangeRanges(
			{ span: { start: 0, length: 0, }, newLength: 1 },
			{ span: { start: 5, length: 1, }, newLength: 1 },
		)).toEqual({ span: { start: 0, length: 6, }, newLength: 7 });
	});

	it(`c`, () => {
		expect(combineMultiLineChangeRanges(
			{ span: { start: 0, length: 1, }, newLength: 1 },
			{ span: { start: 5, length: 1, }, newLength: 1 },
		)).toEqual({ span: { start: 0, length: 6, }, newLength: 6 });
	});
});
