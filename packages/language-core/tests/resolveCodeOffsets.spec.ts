import { expect, test } from 'vitest';
import { resolveCodeOffsets } from '../lib/mappings/resolveCodeOffsets';
import type { CodeSegment, IR, IRBlock, VueCodeMarker } from '../lib/types';

function block(name: string, offset: number) {
	return { name, offset } as IRBlock;
}

const template = block('template', 10);
const scriptSetup = block('scriptSetup', 100);
const style = block('style_0', 200);
const customBlock = block('custom_block_0', 300);

const ir = {
	template,
	script: undefined,
	scriptSetup,
	styles: [style],
	customBlocks: [customBlock],
} as unknown as IR;

type Segment = CodeSegment<VueCodeMarker | undefined>;

const marker = { features: 1 };

test('rebases the segments of IR blocks to file offsets', () => {
	expect(resolveCodeOffsets<VueCodeMarker | undefined>(ir, [
		'text',
		['a', template, 1, marker],
		['b', scriptSetup, 2, undefined],
		['c', style, 3, marker],
		['d', customBlock, 4, marker],
	])).toEqual<Segment[]>([
		'text',
		['a', undefined, 11, marker],
		['b', undefined, 102, undefined],
		['c', undefined, 203, marker],
		['d', undefined, 304, marker],
	]);
});

test('keeps the segments that map by file offsets', () => {
	const sourceless: Segment = ['s', undefined, 7, marker];
	expect(resolveCodeOffsets(ir, [sourceless])[0]).toBe(sourceless);
});

test('throws on a segment of a block that is not a block of the IR', () => {
	const unknown: Segment = ['u', block('template', 10), 6, marker];
	expect(() => resolveCodeOffsets(ir, [unknown])).toThrow(
		`A segment maps from the block 'template', which is not a block of the IR.`,
	);
});
