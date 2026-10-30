import { expect, test } from 'vitest';
import { resolveCodeOffsets } from '../lib/mappings/resolveCodeOffsets';
import type { CodePiece, IR, IRBlock, VueCodeMarker } from '../lib/types';

function block(name: string, offset: number, content = 'abcdefgh') {
	return { name, offset, content } as IRBlock;
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

type Piece = CodePiece<VueCodeMarker | undefined>;

const marker = { features: 1 };

test('rebases the pieces of IR blocks to file offsets, and a copy takes the text of its block', () => {
	expect(resolveCodeOffsets<VueCodeMarker | undefined>(ir, [
		'text',
		{ source: template, start: 1, end: 2, data: marker },
		{ source: scriptSetup, start: 2, end: 3, data: undefined, text: 'x' },
		{ source: style, start: 3, end: 3, data: marker },
		{ source: customBlock, start: 4, end: 6, data: marker, text: 'y' },
	])).toEqual<Piece[]>([
		'text',
		{ source: undefined, start: 11, end: 12, data: marker, text: 'b' },
		{ source: undefined, start: 102, end: 103, data: undefined, text: 'x' },
		{ source: undefined, start: 203, end: 203, data: marker, text: '' },
		{ source: undefined, start: 304, end: 306, data: marker, text: 'y' },
	]);
});

test('keeps the pieces that map by file offsets', () => {
	const sourceless: Piece = { source: undefined, start: 7, end: 8, data: marker, text: 's' };
	expect(resolveCodeOffsets(ir, [sourceless])[0]).toBe(sourceless);
});

test('throws on a piece of a block that is not a block of the IR', () => {
	const unknown: Piece = { source: block('template', 10), start: 6, end: 7, data: marker };
	expect(() => resolveCodeOffsets(ir, [unknown])).toThrow(
		`A piece maps from the block 'template', which is not a block of the IR.`,
	);
});
