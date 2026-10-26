import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, test } from 'vitest';
import {
	createSourceRewrite,
	type MappedSegment,
	type RewriteCode,
	type RewriteSlice,
	type RewriteWriter,
	type SourceRewrite,
} from '../lib/codegen/rewrite';

type Segment = string | MappedSegment<string>;

/** The segments that `slice` renders: text, and kept source runs with the data of their cut. */
function collect(slice: RewriteSlice<string>) {
	const segments: Segment[] = [];
	slice.render({
		text: text => segments.push(text),
		source: (rewrite, start, end, data) => segments.push([rewrite.text.slice(start, end), rewrite.source, start, data]),
		segment: segment => segments.push(segment),
	});
	return segments;
}

function toText(segments: Segment[]) {
	return segments.map(segment => typeof segment === 'string' ? segment : segment[0]).join('');
}

function render(slice: RewriteSlice<string>) {
	return toText(collect(slice));
}

function lazy(...code: (string | RewriteSlice<string>)[]): RewriteCode<string> {
	return () => code;
}

function alphabet(length: number) {
	return Array.from({ length }, (_, index) => String.fromCharCode(97 + index)).join('');
}

/** A deterministic random integer below its argument. */
function createRandom(seed: number) {
	return (below: number) => {
		seed = (seed + 0x6d2b79f5) >>> 0;
		let t = seed;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * below);
	};
}

/** The chars of `text` that the `removals` do not remove. */
function keptOffsets(length: number, removals: readonly [number, number][]) {
	return Array.from({ length }, (_, index) => index)
		.filter(index => !removals.some(([start, end]) => start <= index && index < end));
}

/** Every mapped run is verbatim; returns the source offsets of the rendered chars, in output order. */
function renderedOffsets(rewrite: SourceRewrite<string>, segments: Segment[]) {
	return segments.flatMap(segment => {
		if (typeof segment === 'string') {
			return [];
		}
		const [text, , offset] = segment;
		expect(text).not.toBe('');
		expect(text).toBe(rewrite.text.slice(offset, offset + text.length));
		return [...text].map((_, index) => offset + index);
	});
}

function defineProps(text: string, statement = 'const') {
	const rewrite = createSourceRewrite<string>('setup', text);
	const { core } = rewrite;
	const body = core.cut(0, text.length, { data: 'body' });
	const typeArg = { start: text.indexOf('{'), end: text.lastIndexOf('}') + 1 };
	const alias = core.cut(typeArg.start, typeArg.end, { data: 'alias', placeholder: '__VLS_Props' });
	core.insertBefore(text.indexOf(statement), lazy('type __VLS_Props = ', alias, ';\n'));
	return { rewrite, body, typeArg };
}

describe('scenarios', () => {
	test('core moves a type argument into an alias', () => {
		const { body } = defineProps('const props = defineProps<{ a: string }>();');
		expect(render(body)).toBe('type __VLS_Props = { a: string };\nconst props = defineProps<__VLS_Props>();');
	});

	test('an insert after the start of a moved range stays at its origin', () => {
		const { rewrite, body, typeArg } = defineProps('const props = defineProps<{ a: string }>();');
		const plugin = rewrite.writer(1);
		plugin.insertAfter(typeArg.start, '/* a */');
		plugin.insertAfter(typeArg.start, '/* b */');
		expect(render(body)).toBe(
			'type __VLS_Props = { a: string };\nconst props = defineProps</* a *//* b */__VLS_Props>();',
		);
	});

	test('inserts on the inner sides of a moved range travel with it', () => {
		const { rewrite, body, typeArg } = defineProps('const props = defineProps<{ a: string }>();');
		rewrite.writer(1).insertBefore(typeArg.start, 'Wrap<');
		rewrite.writer(1).insertAfter(typeArg.end, '>');
		expect(render(body)).toBe('type __VLS_Props = Wrap<{ a: string }>;\nconst props = defineProps<__VLS_Props>();');
	});

	test('a replace inside a moved range applies to the moved text, which stays verbatim', () => {
		const text = 'const props = defineProps<{ a: string }>();';
		const { rewrite, body } = defineProps(text);
		const start = text.indexOf('string');
		rewrite.writer(1).replace(start, start + 'string'.length, 'number');
		const segments = collect(body);
		expect(toText(segments)).toBe('type __VLS_Props = { a: number };\nconst props = defineProps<__VLS_Props>();');
		renderedOffsets(rewrite, segments);
	});

	test('nested replaces of two writers keep both codes at their own starts, whatever the ranks', () => {
		const text = 'const a = useFoo();';
		const call = text.indexOf('useFoo()');
		const name = text.indexOf('Foo');
		const edits = [
			(writer: RewriteWriter<string>) => writer.replace(call, call + 'useFoo()'.length, 'first()'),
			(writer: RewriteWriter<string>) => writer.replace(name, name + 'Foo'.length, 'Second'),
		];
		for (const order of [[0, 1], [1, 0]]) {
			const rewrite = createSourceRewrite<string>('s', text);
			const body = rewrite.core.cut(0, text.length, { data: 'body' });
			order.forEach((edit, rank) => edits[edit]!(rewrite.writer(rank + 1)));
			expect(render(body)).toBe('const a = first()Second;');
		}
	});

	test('replaces of one range by two writers keep both codes, inner rank first', () => {
		const text = 'const a = useFoo();';
		const rewrite = createSourceRewrite<string>('s', text);
		const body = rewrite.core.cut(0, text.length, { data: 'body' });
		const call = text.indexOf('useFoo()');
		rewrite.writer(1).replace(call, call + 8, 'A()');
		rewrite.writer(2).replace(call, call + 8, 'B()');
		expect(render(body)).toBe('const a = A()B();');
	});

	test('wraps of two writers nest, the lower rank inside', () => {
		const rewrite = createSourceRewrite<string>('s', 'x = f();');
		const body = rewrite.core.cut(0, 8, { data: 'body' });
		rewrite.writer(1).insertBefore(4, 'A(');
		rewrite.writer(1).insertAfter(7, ')');
		rewrite.writer(2).insertBefore(4, 'B(');
		rewrite.writer(2).insertAfter(7, ')');
		expect(render(body)).toBe('x = B(A(f()));');
	});

	test('an insert at a boundary of two cuts goes by its side, and a removal across them splits', () => {
		const text = `import { a } from 'a';\nconst b = a;`;
		const rewrite = createSourceRewrite<string>('s', text);
		const importEnd = text.indexOf('\n') + 1;
		const imports = rewrite.core.cut(0, importEnd, { data: 'imports' });
		const body = rewrite.core.cut(importEnd, text.length, { data: 'body' });
		const plugin = rewrite.writer(1);
		plugin.insertAfter(importEnd, '/*end of imports*/');
		plugin.insertBefore(importEnd, '/*start of body*/');
		plugin.replace(text.indexOf(`'a';`), text.indexOf('const') + 'const'.length, `'b'; let`);
		expect([render(imports), render(body)]).toEqual([
			`import { a } from 'b'; let/*end of imports*/`,
			'/*start of body*/ b = a;',
		]);
	});

	test('a replace of the first token of a statement keeps the core insert before it', () => {
		const { rewrite, body } = defineProps('const props = defineProps<{ a: string }>();');
		rewrite.writer(1).replace(0, 5, 'let');
		expect(render(body)).toBe('type __VLS_Props = { a: string };\nlet props = defineProps<__VLS_Props>();');
	});

	test('core inserts sit outside the inserts of other writers', () => {
		const rewrite = createSourceRewrite<string>('s', 'useAttrs();');
		const { core } = rewrite;
		const body = core.cut(0, 11, { data: 'body' });
		core.insertBefore(0, '(');
		core.insertAfter(10, ' as A)');
		rewrite.writer(0).insertBefore(0, 'P(');
		rewrite.writer(0).insertAfter(10, ')');
		expect(render(body)).toBe('(P(useAttrs()) as A);');
	});

	test('a run maps with the data of the innermost cut that owns it', () => {
		const { body } = defineProps('const props = defineProps<{ a: string }>();');
		expect(collect(body)).toEqual([
			'type __VLS_Props = ',
			['{ a: string }', 'setup', 26, 'alias'],
			';\n',
			['const props = defineProps<', 'setup', 0, 'body'],
			'__VLS_Props',
			['>();', 'setup', 39, 'body'],
		]);
	});

	test('mapped segments of generated code pass through', () => {
		const rewrite = createSourceRewrite<string>('s', 'ab');
		const body = rewrite.core.cut(0, 2, { data: 'body' });
		rewrite.core.insertAfter(1, () => [['x', 'other', 3, 'mapped']]);
		expect(collect(body)).toEqual([['a', 's', 0, 'body'], ['x', 'other', 3, 'mapped'], ['b', 's', 1, 'body']]);
	});
});

describe('order', () => {
	test('order keys make one side of a char LIFO for decreasing keys and FIFO for equal ones', () => {
		const rewrite = createSourceRewrite<string>('s', 'abc');
		const { core } = rewrite;
		const body = core.cut(0, 3, { data: 'body' });
		core.insertAfter(1, 'A');
		core.insertAfter(1, 'B', { order: -1 });
		core.insertAfter(1, 'C');
		core.insertAfter(1, 'D', { order: -2 });
		expect(render(body)).toBe('aDBACbc');
	});

	test('an order key orders the entries of one rank only', () => {
		const rewrite = createSourceRewrite<string>('s', 'abc');
		const body = rewrite.core.cut(0, 3, { data: 'body' });
		rewrite.writer(0).insertBefore(1, 'p0', { order: 1e9 });
		rewrite.writer(1).insertBefore(1, 'p1', { order: -1e9 });
		expect(render(body)).toBe('ap1p0bc');
	});

	test('the order at a char: before by rank descending, replacement, the char, after by rank ascending', () => {
		const rewrite = createSourceRewrite<string>('s', 'abc');
		const body = rewrite.core.cut(0, 3, { data: 'body' });
		for (const rank of [0, 1]) {
			const writer = rewrite.writer(rank);
			writer.insertBefore(1, `<${rank}`);
			writer.insertAfter(2, `>${rank}`);
		}
		rewrite.writer(1).replace(1, 2, 'R1');
		rewrite.writer(0).replace(1, 2, 'R0');
		rewrite.core.insertBefore(1, '<c');
		rewrite.core.insertAfter(2, '>c');
		expect(render(body)).toBe('a<c<1<0R0R1>0>1>cc');
	});

	test('a non-number order key is an error', () => {
		const rewrite = createSourceRewrite<string>('s', 'abc');
		expect(() => rewrite.core.insertBefore(1, 'x', { order: Number.NaN })).toThrow('is not a number');
	});
});

describe('block edges', () => {
	test('code at the end of the text stays after all text when a cut that ends there moves', () => {
		const rewrite = createSourceRewrite<string>('s', 'abcdefgh');
		const { core } = rewrite;
		const body = core.cut(0, 8, { data: 'body' });
		const last = core.cut(5, 8, { data: 'last' });
		core.insertAfter(0, lazy(last), { order: Infinity });
		core.insertBefore(8, 'X');
		core.insertAfter(8, 'Y');
		expect(render(body)).toBe('fghYabcdeX');
	});

	test('code at the start of the text stays before all text when a cut that starts there moves', () => {
		const rewrite = createSourceRewrite<string>('s', 'abcdefgh');
		const { core } = rewrite;
		const body = core.cut(0, 8, { data: 'body' });
		const first = core.cut(0, 3, { data: 'first' });
		core.insertBefore(8, lazy(first));
		core.insertAfter(0, 'X');
		core.insertBefore(0, 'Y');
		expect(render(body)).toBe('XdefghYabc');
	});

	test('head code renders by rank descending and tail code by rank ascending', () => {
		const rewrite = createSourceRewrite<string>('s', 'ab');
		const body = rewrite.core.cut(0, 2, { data: 'body' });
		for (const [name, writer] of [['0', rewrite.writer(0)], ['c', rewrite.core], ['1', rewrite.writer(1)]] as const) {
			writer.insertAfter(0, `h${name}`);
			writer.insertBefore(2, `t${name}`);
		}
		expect(render(body)).toBe('hch1h0abt0t1tc');
	});

	test('an empty text renders its inserts in the first zero-width cut, after code before code', () => {
		const rewrite = createSourceRewrite<string>('s', '');
		const { core } = rewrite;
		const imports = core.cut(0, 0, { data: 'imports' });
		const body = core.cut(0, 0, { data: 'body' });
		core.insertBefore(0, 'B1');
		rewrite.writer(0).insertAfter(0, 'A0');
		core.insertAfter(0, 'A1');
		core.insertBefore(0, 'B2');
		expect([collect(imports), collect(body)]).toEqual([['A1', 'A0', 'B1', 'B2'], []]);
	});
});

describe('runs', () => {
	test('a removal next to a run boundary or an insert renders no empty run', () => {
		const rewrite = createSourceRewrite<string>('s', 'abcdef');
		const body = rewrite.core.cut(0, 6, { data: 'body' });
		const writer = rewrite.writer(0);
		writer.replace(0, 2, 'X');
		writer.insertBefore(2, 'Y');
		writer.replace(4, 6, '');
		expect(collect(body)).toEqual(['X', 'Y', ['cd', 's', 2, 'body']]);
	});

	test('a text without edits renders as one run', () => {
		const rewrite = createSourceRewrite<string>('s', 'abc');
		expect(collect(rewrite.core.cut(0, 3, { data: 'body' }))).toEqual([['abc', 's', 0, 'body']]);
	});

	test('code is called at most once, and only if it renders', () => {
		const rewrite = createSourceRewrite<string>('s', 'abcdef');
		const { core } = rewrite;
		const body = core.cut(0, 6, { data: 'body' });
		core.cut(2, 4, { data: 'unplaced', placeholder: 'P' });
		let calls = 0;
		const counted = () => {
			calls++;
			return ['x'];
		};
		core.insertBefore(0, counted);
		core.insertBefore(3, counted);
		core.insertAfter(6, counted);
		expect(render(body)).toBe('xabPefx');
		expect(calls).toBe(2);
	});
});

describe('construction errors', () => {
	test('a cut that crosses a cut is an error', () => {
		const rewrite = createSourceRewrite<string>('s', 'abcdef');
		const { core } = rewrite;
		core.cut(0, 6, { data: 'body' });
		core.cut(0, 3, { data: 'a' });
		expect(() => core.cut(2, 5, { data: 'b' })).toThrow(
			'The cut 2..5 crosses the cut 0..3; cuts are nested or disjoint.',
		);
	});

	test('a cut that crosses a sibling other than its neighbours is an error', () => {
		const rewrite = createSourceRewrite<string>('s', 'abcdefg');
		const { core } = rewrite;
		core.cut(1, 2, { data: 'a' });
		core.cut(3, 6, { data: 'b' });
		expect(() => core.cut(0, 4, { data: 'c' })).toThrow('crosses the cut 3..6');
		core.cut(0, 6, { data: 'd' });
		core.cut(2, 6, { data: 'e' });
	});

	test('of two cuts of one range, the later is inside the earlier', () => {
		const rewrite = createSourceRewrite<string>('s', 'abc');
		const { core } = rewrite;
		const outer = core.cut(0, 3, { data: 'outer' });
		const inner = core.cut(0, 3, { data: 'inner', placeholder: 'P' });
		expect(collect(outer)).toEqual(['P']);
		expect(collect(inner)).toEqual([['abc', 's', 0, 'inner']]);
	});

	test('a zero-width cut with a placeholder is an error', () => {
		const rewrite = createSourceRewrite<string>('s', 'abc');
		expect(() => rewrite.core.cut(1, 1, { data: 'a', placeholder: 'P' })).toThrow('cannot have a placeholder');
	});

	test('placing a cut twice is an error', () => {
		const rewrite = createSourceRewrite<string>('s', 'abc');
		const body = rewrite.core.cut(0, 3, { data: 'body' });
		collect(body);
		expect(() => collect(body)).toThrow('The cut 0..3 is placed twice.');
	});

	test('an edit after the first render is an error', () => {
		const rewrite = createSourceRewrite<string>('s', 'abc');
		const body = rewrite.core.cut(0, 3, { data: 'body' });
		collect(body);
		expect(() => rewrite.writer(0).insertBefore(1, 'x')).toThrow('The rewrite is already rendered.');
		expect(() => rewrite.core.cut(1, 2, { data: 'late' })).toThrow('The rewrite is already rendered.');
	});

	test('offsets out of the text, an empty replace and an invalid rank are errors', () => {
		const rewrite = createSourceRewrite<string>('s', 'abc');
		expect(() => rewrite.core.insertBefore(4, 'x')).toThrow('4..4 is out of 0..3.');
		expect(() => rewrite.writer(0).replace(2, 1, 'x')).toThrow('2..1 is out of 0..3.');
		expect(() => rewrite.writer(0).replace(1, 1, 'x')).toThrow('removes no char');
		expect(() => rewrite.writer(-1)).toThrow('is not a non-negative integer');
	});

	test('only core cuts', () => {
		const rewrite = createSourceRewrite<string>('s', 'abc');
		expect('cut' in rewrite.writer(0)).toBe(false);
	});
});

describe('properties', () => {
	test('random edits render every kept char once, in order and verbatim, and every code once', () => {
		const random = createRandom(1);
		for (let iteration = 0; iteration < 20000; iteration++) {
			const length = 1 + random(12);
			const rewrite = createSourceRewrite<string>('s', alphabet(length));
			const { core } = rewrite;
			const root = core.cut(0, length, { data: 'root' });
			let moved: { start: number; end: number } | undefined;
			if (length > 2 && random(2)) {
				const start = 1 + random(length - 2);
				const end = start + 1 + random(length - start - 1);
				const cut = core.cut(start, end, { data: 'moved', placeholder: '<P>' });
				moved = { start, end };
				core.insertBefore(random(start + 1) === start ? 0 : random(start), lazy('{', cut, '}'));
			}
			const removals: [number, number][] = [];
			const tags: string[] = [];
			for (let edit = random(6); edit > 0; edit--) {
				const writer = rewrite.writer(1 + random(3));
				const tag = `#${tags.length}`;
				const kind = random(3);
				if (kind === 0) {
					writer.insertBefore(random(length + 1), tag);
				}
				else if (kind === 1) {
					writer.insertAfter(random(length + 1), tag);
				}
				else {
					const start = random(length);
					const end = start + 1 + random(length - start);
					writer.replace(start, end, tag);
					removals.push([start, end]);
				}
				tags.push(tag);
			}
			const segments = collect(root);
			const offsets = renderedOffsets(rewrite, segments);
			expect([...offsets].sort((a, b) => a - b)).toEqual(keptOffsets(length, removals));
			const unmoved = offsets.filter(offset => !moved || offset < moved.start || moved.end <= offset);
			expect(unmoved).toEqual([...unmoved].sort((a, b) => a - b));
			const text = toText(segments);
			for (const tag of tags) {
				expect(text.split(tag).length).toBe(2);
			}
		}
	});

	test('random edits render the same whatever order the writers register in', () => {
		const random = createRandom(2);
		for (let iteration = 0; iteration < 5000; iteration++) {
			const length = 1 + random(10);
			const edits = Array.from({ length: random(7) }, (_, index) => {
				const rank = random(3);
				const kind = random(3);
				const start = random(length);
				const end = start + 1 + random(length - start);
				const offset = random(length + 1);
				const tag = `#${index}`;
				return {
					rank,
					apply: (writer: RewriteWriter<string>) =>
						kind === 0
							? writer.insertBefore(offset, tag)
							: kind === 1
							? writer.insertAfter(offset, tag)
							: writer.replace(start, end, tag),
				};
			});
			const renderEdits = (list: typeof edits) => {
				const rewrite = createSourceRewrite<string>('s', alphabet(length));
				const root = rewrite.core.cut(0, length, { data: 'root' });
				for (const edit of list) {
					edit.apply(rewrite.writer(edit.rank));
				}
				return render(root);
			};
			// interleave the writers, keeping the call order of each
			const queues = [0, 1, 2].map(rank => edits.filter(edit => edit.rank === rank));
			const interleaved = edits.map(() => random(3)).map(rank =>
				queues[rank]!.length ? queues[rank]!.shift()! : queues.find(queue => queue.length)!.shift()!
			);
			expect(renderEdits(interleaved)).toBe(renderEdits(edits));
		}
	});

	test('random nested cuts render every kept char once and verbatim, every code once, edge code at the edges', () => {
		const random = createRandom(3);
		let nested = 0;
		for (let iteration = 0; iteration < 20000; iteration++) {
			const length = 1 + random(14);
			const testCase = createNestedCase(random, length);
			if (
				testCase.cuts.some(cut =>
					testCase.cuts.some(other => other !== cut && other.start <= cut.start && cut.end <= other.end)
				)
			) {
				nested++;
			}
			const rewrite = createSourceRewrite<string>('s', alphabet(length));
			const segments = buildNestedCase(rewrite, testCase);
			const offsets = renderedOffsets(rewrite, segments);
			const removals = testCase.edits.flatMap(edit =>
				edit.kind === 'replace' ? [[edit.start, edit.end] as [number, number]] : []
			);
			expect(offsets.sort((a, b) => a - b)).toEqual(keptOffsets(length, removals));
			const text = toText(segments);
			for (const edit of testCase.edits) {
				expect(text.split(edit.tag).length).toBe(2);
			}
			const head = testCase.edits.filter(edit => edit.kind === 'insertAfter' && edit.start === 0);
			const tail = testCase.edits.filter(edit => edit.kind === 'insertBefore' && edit.start === length);
			if (head.length) {
				expect(head.some(edit => text.startsWith(edit.tag))).toBe(true);
			}
			if (tail.length) {
				expect(tail.some(edit => text.endsWith(edit.tag))).toBe(true);
			}
		}
		expect(nested).toBeGreaterThan(1000);
	});
});

interface NestedCut {
	start: number;
	end: number;
	id: number;
	inPlace: boolean;
	place?: { at: number; after: boolean };
}

interface NestedEdit {
	kind: 'insertBefore' | 'insertAfter' | 'replace';
	rank: number | undefined;
	start: number;
	end: number;
	tag: string;
}

/** Random edits and a random family of nested or disjoint cuts, each placed in place or at a char of its parent. */
function createNestedCase(random: (below: number) => number, length: number) {
	const cuts: NestedCut[] = [];
	const grow = (start: number, end: number, depth: number) => {
		if (depth > 3 || end - start < 1) {
			return;
		}
		for (let count = random(3); count > 0; count--) {
			const a = start + random(end - start);
			const b = a + 1 + random(end - a);
			if (
				cuts.some(cut =>
					(cut.start < a && a < cut.end && cut.end < b) || (a < cut.start && cut.start < b && b < cut.end)
				)
			) {
				continue;
			}
			cuts.push({ start: a, end: b, id: cuts.length, inPlace: random(3) === 0 });
			if (random(4) === 0) {
				cuts.push({ start: a, end: b, id: cuts.length, inPlace: random(2) === 0 });
			}
			grow(a, b, depth + 1);
		}
	};
	if (random(4)) {
		grow(0, length, 0);
	}
	// the innermost cut that contains a cut; of two cuts of one range, the earlier
	const parentOf = (cut: NestedCut) => {
		let parent: NestedCut | undefined;
		for (const other of cuts) {
			const contains = other !== cut && other.start <= cut.start && cut.end <= other.end
				&& (other.end - other.start > cut.end - cut.start || other.id < cut.id);
			if (
				contains
				&& (!parent || other.end - other.start < parent.end - parent.start
					|| (other.end - other.start === parent.end - parent.start && other.id > parent.id))
			) {
				parent = other;
			}
		}
		return parent;
	};
	for (const cut of cuts) {
		const parent = parentOf(cut);
		const [start, end] = parent ? [parent.start, parent.end] : [0, length];
		// a char that the parent owns: placing the cut there cannot place it inside itself
		const free: number[] = [];
		for (let index = start; index < end; index++) {
			if (
				!cuts.some(other => other !== parent && parentOf(other) === parent && other.start <= index && index < other.end)
			) {
				free.push(index);
			}
		}
		if (!cut.inPlace && free.length) {
			cut.place = { at: free[random(free.length)]!, after: !!random(2) };
		}
	}
	const edits: NestedEdit[] = [];
	const kinds = ['insertBefore', 'insertAfter', 'replace'] as const;
	for (let count = random(8); count > 0; count--) {
		const kind = kinds[random(3)]!;
		const rank = random(3);
		const start = kind === 'replace' ? random(length) : random(length + 1);
		const end = kind === 'replace' ? start + 1 + random(length - start) : start;
		edits.push({ kind, rank, start, end, tag: `#${edits.length}` });
	}
	if (random(2)) {
		const offset = random(length + 1);
		edits.push({ kind: kinds[random(2)]!, rank: undefined, start: offset, end: offset, tag: `#${edits.length}` });
	}
	return { length, cuts, edits };
}

function buildNestedCase(rewrite: SourceRewrite<string>, { length, cuts, edits }: ReturnType<typeof createNestedCase>) {
	const { core } = rewrite;
	const root = core.cut(0, length, { data: 'root' });
	const slices: RewriteSlice<string>[] = [];
	for (const cut of cuts) {
		const placeholder = cut.place ? `<P${cut.id}>` : () => ['<', slices[cut.id]!, '>'];
		slices[cut.id] = core.cut(cut.start, cut.end, { data: `cut${cut.id}`, placeholder });
	}
	for (const cut of cuts) {
		if (cut.place) {
			const code = () => ['{', slices[cut.id]!, '}'];
			if (cut.place.after) {
				core.insertAfter(cut.place.at + 1, code);
			}
			else {
				core.insertBefore(cut.place.at, code);
			}
		}
	}
	for (const edit of edits) {
		const writer = edit.rank === undefined ? core : rewrite.writer(edit.rank);
		if (edit.kind === 'replace') {
			writer.replace(edit.start, edit.end, edit.tag);
		}
		else {
			writer[edit.kind](edit.start, edit.tag);
		}
	}
	return collect(root);
}

test('the core imports nothing but the type of a code segment', () => {
	const source = fs.readFileSync(path.join(__dirname, '../lib/codegen/rewrite/index.ts'), 'utf8');
	expect(source.match(/^import .*$/gm)).toEqual([`import type { CodeSegment } from '@vue/language-core';`]);
});
