import { describe, expect, it } from 'vitest';
import { updateRange } from '../out/languageFeatures/validation';

describe(`Test updateRange()`, () => {

	// No change

	it(`
123
^^^
-----
123x
^^^
	`, () => {
		expect(updateRange(
			{
				start: { line: 0, character: 0 },
				end: { line: 0, character: 3 },
			},
			{
				range: {
					start: { line: 0, character: 3 },
					end: { line: 0, character: 3 },
				},
				newEnd: { line: 0, character: 4 },
			},
		)).toEqual({
			start: { line: 0, character: 0 },
			end: { line: 0, character: 3 },
		});
	});

	it(`
x
123
^^^
-----
xx
123
^^^
	`, () => {
		expect(updateRange(
			{
				start: { line: 1, character: 0 },
				end: { line: 1, character: 3 },
			},
			{
				range: {
					start: { line: 0, character: 1 },
					end: { line: 0, character: 1 },
				},
				newEnd: { line: 0, character: 2 },
			},
		)).toEqual({
			start: { line: 1, character: 0 },
			end: { line: 1, character: 3 },
		});
	});

	it(`
123
^^^
-----
1xxxx
^^^
	`, () => {
		expect(updateRange(
			{
				start: { line: 0, character: 0 },
				end: { line: 0, character: 3 },
			},
			{
				range: {
					start: { line: 0, character: 1 },
					end: { line: 0, character: 3 },
				},
				newEnd: { line: 0, character: 5 },
			},
		)).toEqual({
			start: { line: 0, character: 0 },
			end: { line: 0, character: 3 },
		});
	});

	// Single line change

	it(`
123
^^^
-----
x123
 ^^^
	`, () => {
		expect(updateRange(
			{
				start: { line: 0, character: 0 },
				end: { line: 0, character: 3 },
			},
			{
				range: {
					start: { line: 0, character: 0 },
					end: { line: 0, character: 0 },
				},
				newEnd: { line: 0, character: 1 },
			},
		)).toEqual(
			{
				start: { line: 0, character: 1 },
				end: { line: 0, character: 4 },
			}
		);
	});

	it(`
x123
 ^^^
-----
123
^^^
	`, () => {
		expect(updateRange(
			{
				start: { line: 0, character: 1 },
				end: { line: 0, character: 4 },
			},
			{
				range: {
					start: { line: 0, character: 0 },
					end: { line: 0, character: 1 },
				},
				newEnd: { line: 0, character: 0 },
			},
		)).toEqual(
			{
				start: { line: 0, character: 0 },
				end: { line: 0, character: 3 },
			}
		);
	});

	it(`
123
^^^
-----
1x23
^^^^
	`, () => {
		expect(updateRange(
			{
				start: { line: 0, character: 0 },
				end: { line: 0, character: 3 },
			},
			{
				range: {
					start: { line: 0, character: 1 },
					end: { line: 0, character: 1 },
				},
				newEnd: { line: 0, character: 2 },
			},
		)).toEqual(
			{
				start: { line: 0, character: 0 },
				end: { line: 0, character: 4 },
			}
		);
	});

	it(`
123
^^^
-----
xxx23
^^^^^
	`, () => {
		expect(updateRange(
			{
				start: { line: 0, character: 0 },
				end: { line: 0, character: 3 },
			},
			{
				range: {
					start: { line: 0, character: 0 },
					end: { line: 0, character: 1 },
				},
				newEnd: { line: 0, character: 3 },
			},
		)).toEqual(
			{
				start: { line: 0, character: 0 },
				end: { line: 0, character: 5 },
			}
		);
	});

	it(`
123xxx
^^^
-----
12xx
^^
	`, () => {
		expect(updateRange(
			{
				start: { line: 0, character: 0 },
				end: { line: 0, character: 3 },
			},
			{
				range: {
					start: { line: 0, character: 2 },
					end: { line: 0, character: 4 },
				},
				newEnd: { line: 0, character: 2 },
			},
		)).toEqual(
			{
				start: { line: 0, character: 0 },
				end: { line: 0, character: 2 },
			}
		);
	});

	it(`
x12x
 ^^
-----
xx
 ^
	`, () => {
		expect(updateRange(
			{
				start: { line: 0, character: 1 },
				end: { line: 0, character: 3 },
			},
			{
				range: {
					start: { line: 0, character: 1 },
					end: { line: 0, character: 3 },
				},
				newEnd: { line: 0, character: 1 },
			},
		)).toEqual(
			{
				start: { line: 0, character: 1 },
				end: { line: 0, character: 2 },
			}
		);
	});

	it(`
xx12x
  ^^
-----
xx
 ^
	`, () => {
		expect(updateRange(
			{
				start: { line: 0, character: 2 },
				end: { line: 0, character: 4 },
			},
			{
				range: {
					start: { line: 0, character: 1 },
					end: { line: 0, character: 4 },
				},
				newEnd: { line: 0, character: 1 },
			},
		)).toEqual(
			{
				start: { line: 0, character: 1 },
				end: { line: 0, character: 2 },
			}
		);
	});

	it(`
1
|
-----
1x
 |
	`, () => {
		expect(updateRange(
			{
				start: { line: 0, character: 1 },
				end: { line: 0, character: 1 },
			},
			{
				range: {
					start: { line: 0, character: 1 },
					end: { line: 0, character: 1 },
				},
				newEnd: { line: 0, character: 2 },
			},
		)).toEqual(
			{
				start: { line: 0, character: 2 },
				end: { line: 0, character: 2 },
			}
		);
	});

	// Multiple lines

	it(`
123
^^^
-----
x
123
^^^
	`, () => {
		expect(updateRange(
			{
				start: { line: 0, character: 0 },
				end: { line: 0, character: 3 },
			},
			{
				range: {
					start: { line: 0, character: 0 },
					end: { line: 0, character: 0 },
				},
				newEnd: { line: 1, character: 0 },
			},
		)).toEqual(
			{
				start: { line: 1, character: 0 },
				end: { line: 1, character: 3 },
			}
		);
	});

	it(`
123
^^^
-----
x
x123
 ^^^
	`, () => {
		expect(updateRange(
			{
				start: { line: 0, character: 0 },
				end: { line: 0, character: 3 },
			},
			{
				range: {
					start: { line: 0, character: 0 },
					end: { line: 0, character: 0 },
				},
				newEnd: { line: 1, character: 1 },
			},
		)).toEqual(
			{
				start: { line: 1, character: 1 },
				end: { line: 1, character: 4 },
			}
		);
	});

	it(`
x
123
^^^
-----
123
^^^
	`, () => {
		expect(updateRange(
			{
				start: { line: 1, character: 0 },
				end: { line: 1, character: 3 },
			},
			{
				range: {
					start: { line: 0, character: 0 },
					end: { line: 1, character: 0 },
				},
				newEnd: { line: 0, character: 0 },
			},
		)).toEqual(
			{
				start: { line: 0, character: 0 },
				end: { line: 0, character: 3 },
			}
		);
	});

	it(`
123
^^^
-----
12
^^
3
^
	`, () => {
		expect(updateRange(
			{
				start: { line: 0, character: 0 },
				end: { line: 0, character: 3 },
			},
			{
				range: {
					start: { line: 0, character: 2 },
					end: { line: 0, character: 2 },
				},
				newEnd: { line: 1, character: 0 },
			},
		)).toEqual(
			{
				start: { line: 0, character: 0 },
				end: { line: 1, character: 1 },
			}
		);
	});

	it(`
123
^^^
-----
12
^^
x3
^^
	`, () => {
		expect(updateRange(
			{
				start: { line: 0, character: 0 },
				end: { line: 0, character: 3 },
			},
			{
				range: {
					start: { line: 0, character: 2 },
					end: { line: 0, character: 2 },
				},
				newEnd: { line: 1, character: 1 },
			},
		)).toEqual(
			{
				start: { line: 0, character: 0 },
				end: { line: 1, character: 2 },
			}
		);
	});

	it(`
123
^^^
xxxxx
-----
xxxxx
^
	`, () => {
		expect(updateRange(
			{
				start: { line: 0, character: 0 },
				end: { line: 0, character: 3 },
			},
			{
				range: {
					start: { line: 0, character: 0 },
					end: { line: 1, character: 0 },
				},
				newEnd: { line: 0, character: 0 },
			},
		)).toEqual(
			{
				start: { line: 0, character: 0 },
				end: { line: 0, character: 1 },
			}
		);
	});

	it(`
xxx
xx123
  ^^^
-----
xx
  ^
	`, () => {
		expect(updateRange(
			{
				start: { line: 1, character: 2 },
				end: { line: 1, character: 5 },
			},
			{
				range: {
					start: { line: 0, character: 2 },
					end: { line: 1, character: 5 },
				},
				newEnd: { line: 0, character: 2 },
			},
		)).toEqual(
			{
				start: { line: 0, character: 2 },
				end: { line: 0, character: 3 },
			}
		);
	});

	it(`
xxx
123
^^^
-----
xxx123
   ^^^
	`, () => {
		expect(updateRange(
			{
				start: { line: 1, character: 0 },
				end: { line: 1, character: 3 },
			},
			{
				range: {
					start: { line: 0, character: 3 },
					end: { line: 1, character: 0 },
				},
				newEnd: { line: 0, character: 3 },
			},
		)).toEqual(
			{
				start: { line: 0, character: 3 },
				end: { line: 0, character: 6 },
			}
		);
	});

	it(`
123
^^^
xxx
-----
xxx
|
	`, () => {
		expect(updateRange(
			{
				start: { line: 0, character: 0 },
				end: { line: 0, character: 3 },
			},
			{
				range: {
					start: { line: 0, character: 0 },
					end: { line: 1, character: 0 },
				},
				newEnd: { line: 0, character: 0 },
			},
		)).toEqual(
			{
				start: { line: 0, character: 0 },
				end: { line: 0, character: 1 },
			}
		);
	});
});
