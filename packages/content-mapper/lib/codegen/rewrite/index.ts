import type { CodeSegment } from '@vue/language-core';

/** A segment of generated code that maps to a source. */
export type MappedSegment<Data> = Exclude<CodeSegment<Data>, string>;

/** Generated code: eager text, or a function that is called at most once, and only if the code renders. */
export type RewriteCode<Data> = string | (() => Iterable<CodeSegment<Data> | RewriteSlice<Data>>);

export interface InsertOptions {
	/** Ascending among the entries of one writer at one side of one char; equal keys keep call order. Default 0. */
	order?: number;
}

/** Where a slice renders to. */
export interface RewriteSink<Data> {
	/** Generated text, never empty. */
	text(text: string): void;
	/** The kept chars `start`..`end` (never empty) of the text of `rewrite`, owned by a cut whose data is `data`. */
	source(rewrite: SourceRewrite<Data>, start: number, end: number, data: Data): void;
	/** A mapped segment that generated code carries. */
	segment(segment: MappedSegment<Data>): void;
}

export interface RewriteWriter<Data> {
	/**
	 * `code` right before the text that starts at `offset`; it goes wherever that text goes. At the end of the text,
	 * no text starts there: the code stays after all text.
	 */
	insertBefore(offset: number, code: RewriteCode<Data>, options?: InsertOptions): void;
	/**
	 * `code` right after the text that ends at `offset`; it goes wherever that text goes. At 0, no text ends there: the
	 * code stays before all text.
	 */
	insertAfter(offset: number, code: RewriteCode<Data>, options?: InsertOptions): void;
	/** The text at `start`..`end` (not empty) is not rendered; `code` takes the place of its first char. */
	replace(start: number, end: number, code: RewriteCode<Data>, options?: InsertOptions): void;
}

export interface CoreRewriteWriter<Data> extends RewriteWriter<Data> {
	/**
	 * The text at `start`..`end`, with the edits of all writers in it, rendered where the returned slice is placed,
	 * exactly once. In the cut that contains it, `placeholder` takes its place. Cuts are nested or disjoint, and of two
	 * cuts of one range the later is inside the earlier. A zero-width cut owns no char and has no placeholder; on an
	 * empty text, the first one renders the inserts.
	 */
	cut(start: number, end: number, options: { data: Data; placeholder?: RewriteCode<Data> }): RewriteSlice<Data>;
}

export interface RewriteSlice<Data> {
	render(sink: RewriteSink<Data>): void;
}

/**
 * Edits of one source text by ranked writers. Inserts attach to a side of a char, removals add up, and only core
 * moves text, by nested cuts, so edits never conflict. The first render freezes the edits.
 */
export interface SourceRewrite<Data> {
	readonly source: string;
	readonly text: string;
	readonly core: CoreRewriteWriter<Data>;
	/** The writer of `rank`, a non-negative integer. A higher rank sits outside a lower one, and core outside all. */
	writer(rank: number): RewriteWriter<Data>;
}

export function createSourceRewrite<Data>(source: string, text: string): SourceRewrite<Data> {
	return new Rewrite<Data>(source, text);
}

const coreRank = 0x7fffffff;

// the sides of a char, in render order: code before the text that starts at the char, replacement code in the place
// of the char, code after the text that ends at the char
const enum Side {
	Before,
	Slot,
	After,
}

interface EditRecord<Data> {
	at: number;
	side: Side;
	rank: number;
	order: number;
	seq: number;
	code: RewriteCode<Data>;
}

// Before: outermost (highest rank) first; Slot and After: innermost first
function compareEdits<Data>(a: EditRecord<Data>, b: EditRecord<Data>) {
	if (a.at !== b.at) {
		return a.at - b.at;
	}
	if (a.side !== b.side) {
		return a.side - b.side;
	}
	if (a.rank !== b.rank) {
		return a.side === Side.Before ? b.rank - a.rank : a.rank - b.rank;
	}
	if (a.order !== b.order) {
		return a.order < b.order ? -1 : 1;
	}
	return a.seq - b.seq;
}

class Edits<Data> {
	records: EditRecord<Data>[] = [];
	// the sorted records by column, filled when frozen
	at = new Int32Array(0);
	side = new Uint8Array(0);
	code: RewriteCode<Data>[] = [];

	push(at: number, side: Side, rank: number, order: number, code: RewriteCode<Data>) {
		this.records.push({ at, side, rank, order, seq: this.records.length, code });
	}

	freeze() {
		const records = this.records;
		// every writer's edits usually arrive in order; the sort is linear on such runs
		for (let i = 1; i < records.length; i++) {
			if (compareEdits(records[i - 1]!, records[i]!) > 0) {
				records.sort(compareEdits);
				break;
			}
		}
		const size = records.length;
		this.at = new Int32Array(size);
		this.side = new Uint8Array(size);
		this.code = new Array(size);
		for (let i = 0; i < size; i++) {
			const record = records[i]!;
			this.at[i] = record.at;
			this.side[i] = record.side;
			this.code[i] = record.code;
		}
	}

	/** The first index from `low` whose anchor is at or after `offset`. */
	lowerBound(offset: number, low: number) {
		let high = this.at.length;
		while (low < high) {
			const mid = (low + high) >>> 1;
			if (this.at[mid]! < offset) {
				low = mid + 1;
			}
			else {
				high = mid;
			}
		}
		return low;
	}
}

class Rewrite<Data> implements SourceRewrite<Data> {
	readonly core: CoreRewriteWriter<Data>;
	edits = new Edits<Data>();
	/** `insertAfter(0)`: before all text. */
	head = new Edits<Data>();
	/** `insertBefore(length)`: after all text. */
	tail = new Edits<Data>();
	/** Removed ranges as flat start, end pairs; merged when frozen. */
	removals: number[] = [];
	/** The top-level cuts, sorted and disjoint. */
	roots: Cut<Data>[] = [];
	/** The last inserted cut, where the descent of the next one starts if it contains it. */
	lastCut: Cut<Data> | undefined;
	/** On an empty text: the first zero-width cut, which renders the inserts. */
	firstEmpty: Cut<Data> | undefined;
	frozen = false;

	constructor(readonly source: string, readonly text: string) {
		const core = this.createWriter(coreRank) as CoreRewriteWriter<Data>;
		core.cut = (start, end, { data, placeholder }) => {
			this.check(start, end);
			const cut = new Cut(this, start, end, data, placeholder);
			if (start === end) {
				if (placeholder !== undefined) {
					throw new RangeError(`The empty cut ${start}..${end} cannot have a placeholder.`);
				}
				if (!this.text.length) {
					this.firstEmpty ??= cut;
				}
			}
			else {
				this.insertCut(cut);
			}
			return cut;
		};
		this.core = core;
	}

	writer(rank: number): RewriteWriter<Data> {
		if (!Number.isInteger(rank) || rank < 0 || rank >= coreRank) {
			throw new RangeError(`The rank ${rank} is not a non-negative integer below the rank of core.`);
		}
		return this.createWriter(rank);
	}

	private createWriter(rank: number): RewriteWriter<Data> {
		return {
			insertBefore: (offset, code, options) => {
				this.check(offset, offset);
				const order = getOrder(options);
				if (offset === this.text.length) {
					this.tail.push(offset, Side.After, rank, order, code);
				}
				else {
					this.edits.push(offset, Side.Before, rank, order, code);
				}
			},
			insertAfter: (offset, code, options) => {
				this.check(offset, offset);
				const order = getOrder(options);
				if (offset === 0) {
					this.head.push(0, Side.Before, rank, order, code);
				}
				else {
					this.edits.push(offset - 1, Side.After, rank, order, code);
				}
			},
			replace: (start, end, code, options) => {
				this.check(start, end);
				if (start === end) {
					throw new RangeError(`The replace at ${start}..${end} removes no char.`);
				}
				this.edits.push(start, Side.Slot, rank, getOrder(options), code);
				this.removals.push(start, end);
			},
		};
	}

	private check(start: number, end: number) {
		if (this.frozen) {
			throw new Error('The rewrite is already rendered.');
		}
		if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > end || end > this.text.length) {
			throw new RangeError(`${start}..${end} is out of 0..${this.text.length}.`);
		}
	}

	// A cut that crosses `cut` intersects it, so it lies inside every cut that contains `cut`: the descent only checks
	// the siblings that `cut` intersects, of the innermost cut that contains it.
	private insertCut(cut: Cut<Data>) {
		const { start, end } = cut;
		const last = this.lastCut;
		let siblings = last && last.start <= start && end <= last.end ? last.children : this.roots;
		while (true) {
			let first = 0;
			let after = siblings.length;
			for (let high = after; first < high;) {
				const mid = (first + high) >>> 1;
				if (siblings[mid]!.end <= start) {
					first = mid + 1;
				}
				else {
					high = mid;
				}
			}
			for (let low = first; low < after;) {
				const mid = (low + after) >>> 1;
				if (siblings[mid]!.start < end) {
					low = mid + 1;
				}
				else {
					after = mid;
				}
			}
			if (after - first === 1 && siblings[first]!.start <= start && end <= siblings[first]!.end) {
				siblings = siblings[first]!.children;
				continue;
			}
			if (after > first) {
				// the siblings in between lie strictly inside `cut`
				for (const sibling of [siblings[first]!, siblings[after - 1]!]) {
					if (sibling.start < start || sibling.end > end) {
						throw new RangeError(
							`The cut ${start}..${end} crosses the cut ${sibling.start}..${sibling.end}; cuts are nested or disjoint.`,
						);
					}
				}
				cut.children = siblings.splice(first, after - first, cut);
			}
			else {
				siblings.splice(first, 0, cut);
			}
			this.lastCut = cut;
			return;
		}
	}

	freeze() {
		if (this.frozen) {
			return;
		}
		this.frozen = true;
		this.edits.freeze();
		this.head.freeze();
		this.tail.freeze();
		const removals = this.removals;
		const pairs = removals.length >> 1;
		for (let pair = 1; pair < pairs; pair++) {
			if (removals[2 * pair - 2]! > removals[2 * pair]!) {
				const sorted = Array.from({ length: pairs }, (_, index) => [removals[2 * index]!, removals[2 * index + 1]!])
					.sort((a, b) => a[0]! - b[0]!);
				for (let index = 0; index < pairs; index++) {
					removals[2 * index] = sorted[index]![0]!;
					removals[2 * index + 1] = sorted[index]![1]!;
				}
				break;
			}
		}
		let merged = 0;
		for (let pair = 0; pair < pairs; pair++) {
			const start = removals[2 * pair]!;
			const end = removals[2 * pair + 1]!;
			if (merged && start <= removals[merged - 1]!) {
				if (end > removals[merged - 1]!) {
					removals[merged - 1] = end;
				}
			}
			else {
				removals[merged++] = start;
				removals[merged++] = end;
			}
		}
		removals.length = merged;
		for (const root of this.roots) {
			root.isRoot = true;
		}
	}
}

function getOrder(options: InsertOptions | undefined) {
	const order = options?.order ?? 0;
	if (typeof order !== 'number' || Number.isNaN(order)) {
		throw new TypeError(`The order ${order} is not a number.`);
	}
	return order;
}

class Cut<Data> implements RewriteSlice<Data> {
	/** The cuts directly inside, sorted and disjoint. */
	children: Cut<Data>[] = [];
	isRoot = false;
	placed = false;

	constructor(
		readonly rewrite: Rewrite<Data>,
		readonly start: number,
		readonly end: number,
		readonly data: Data,
		readonly placeholder: RewriteCode<Data> | undefined,
	) {}

	render(sink: RewriteSink<Data>) {
		if (this.placed) {
			throw new Error(`The cut ${this.start}..${this.end} is placed twice.`);
		}
		this.placed = true;
		const rewrite = this.rewrite;
		rewrite.freeze();
		const { edits, removals, head, tail } = rewrite;
		const { start, end, children, data } = this;
		if (start === end) {
			if (this === rewrite.firstEmpty) {
				renderAll(head, sink);
				renderAll(tail, sink);
			}
			return;
		}
		if (this.isRoot && start === 0) {
			renderAll(head, sink);
		}
		const removalsEnd = removals.length;
		let pos = start;
		let removal = 0;
		// the first removal that ends after `pos`, from `removal` on
		const seekRemoval = () => {
			let low = removal >> 1;
			let high = removalsEnd >> 1;
			while (low < high) {
				const mid = (low + high) >>> 1;
				if (removals[2 * mid + 1]! <= pos) {
					low = mid + 1;
				}
				else {
					high = mid;
				}
			}
			removal = low * 2;
		};
		// the kept chars from `pos` to `to`, as runs between the removals
		const renderText = (to: number) => {
			while (pos < to) {
				while (removal < removalsEnd && removals[removal + 1]! <= pos) {
					removal += 2;
				}
				if (removal < removalsEnd && removals[removal]! <= pos) {
					pos = Math.min(removals[removal + 1]!, to);
					continue;
				}
				const stop = removal < removalsEnd ? Math.min(removals[removal]!, to) : to;
				sink.source(rewrite, pos, stop, data);
				pos = stop;
			}
		};
		seekRemoval();
		const { at, side, code } = edits;
		const size = at.length;
		let edit = edits.lowerBound(start, 0);
		for (let index = 0;; index++) {
			const child = children[index];
			const until = child ? child.start : end;
			for (; edit < size && at[edit]! < until; edit++) {
				renderText(side[edit] === Side.After ? at[edit]! + 1 : at[edit]!);
				renderCode(code[edit]!, sink);
			}
			if (!child) {
				break;
			}
			renderText(child.start);
			if (child.placeholder !== undefined) {
				renderCode(child.placeholder, sink);
			}
			pos = child.end;
			seekRemoval();
			edit = edits.lowerBound(child.end, edit);
		}
		renderText(end);
		if (this.isRoot && end === rewrite.text.length) {
			renderAll(tail, sink);
		}
	}
}

function renderAll<Data>(edits: Edits<Data>, sink: RewriteSink<Data>) {
	for (const code of edits.code) {
		renderCode(code, sink);
	}
}

function renderCode<Data>(code: RewriteCode<Data>, sink: RewriteSink<Data>) {
	if (typeof code === 'string') {
		if (code) {
			sink.text(code);
		}
		return;
	}
	for (const item of code()) {
		if (typeof item === 'string') {
			if (item) {
				sink.text(item);
			}
		}
		else if (Array.isArray(item)) {
			sink.segment(item);
		}
		else {
			item.render(sink);
		}
	}
}
