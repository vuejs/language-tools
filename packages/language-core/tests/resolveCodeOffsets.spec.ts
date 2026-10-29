import { expect, test } from 'vitest';
import { resolveCodeOffsets } from '../lib/mappings/resolveCodeOffsets';
import type { CodeSegment, IR, IRBlock, VueCodeMarker } from '../lib/types';

function block(name: string, offset: number) {
	return { name, offset } as IRBlock;
}

const ir = {
	template: block('template', 10),
	script: undefined,
	scriptSetup: block('scriptSetup', 100),
	styles: [block('style_0', 200)],
	customBlocks: [block('custom_block_0', 300)],
} as unknown as IR;

type Segment = CodeSegment<VueCodeMarker | undefined>;

const marker = { features: 1 };

test('rebases the segments of IR blocks to file offsets', () => {
	expect(resolveCodeOffsets<VueCodeMarker | undefined>(ir, [
		'text',
		['a', 'template', 1, marker],
		['b', 'scriptSetup', 2, undefined],
		['c', 'style_0', 3, marker],
		['d', 'custom_block_0', 4, marker],
	])).toEqual<Segment[]>([
		'text',
		['a', undefined, 11, marker],
		['b', undefined, 102, undefined],
		['c', undefined, 203, marker],
		['d', undefined, 304, marker],
	]);
});

test('keeps the segments of other sources untouched', () => {
	const main: Segment = ['m', 'main', 5, marker];
	const unknown: Segment = ['u', 'script', 6, marker];
	const sourceless: Segment = ['s', undefined, 7, marker];
	const result = resolveCodeOffsets(ir, [main, unknown, sourceless]);
	expect(result[0]).toBe(main);
	expect(result[1]).toBe(unknown);
	expect(result[2]).toBe(sourceless);
});
