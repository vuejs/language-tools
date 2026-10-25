import { expect, test } from 'vitest';
import type { Code, IR, IRBlock } from '../lib/types';
import { resolveCodeOffsets } from '../lib/utils/resolveCodeOffsets';

function block(name: string, startTagEnd: number) {
	return { name, startTagEnd } as IRBlock;
}

const ir = {
	template: block('template', 10),
	script: undefined,
	scriptSetup: block('scriptSetup', 100),
	styles: [block('style_0', 200)],
	customBlocks: [block('custom_block_0', 300)],
} as unknown as IR;

const marker = { features: 1 };

test('rebases the segments of IR blocks to file offsets', () => {
	expect(resolveCodeOffsets(ir, [
		'text',
		['a', 'template', 1, marker],
		['b', 'scriptSetup', 2, undefined],
		['c', 'style_0', 3, marker],
		['d', 'custom_block_0', 4, marker],
	])).toEqual<Code[]>([
		'text',
		['a', undefined, 11, marker],
		['b', undefined, 102, undefined],
		['c', undefined, 203, marker],
		['d', undefined, 304, marker],
	]);
});

test('keeps the segments of other sources untouched', () => {
	const main: Code = ['m', 'main', 5, marker];
	const unknown: Code = ['u', 'script', 6, marker];
	const sourceless: Code = ['s', undefined, 7, marker];
	const result = resolveCodeOffsets(ir, [main, unknown, sourceless]);
	expect(result[0]).toBe(main);
	expect(result[1]).toBe(unknown);
	expect(result[2]).toBe(sourceless);
});
