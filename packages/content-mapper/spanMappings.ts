import {
	type Mapping,
	SpanMapFeature as VolarSpanMapFeature,
	SpanMapKind as VolarSpanMapKind,
} from '@vue/language-core';
import { SpanMapFeature, SpanMapKind, type SpanMapping } from './protocol';

const completionFeatures = SpanMapFeature.Completion
	| SpanMapFeature.AutoInsert;
const navigationFeatures = SpanMapFeature.Definition
	| SpanMapFeature.TypeDefinition
	| SpanMapFeature.Implementation
	| SpanMapFeature.References
	| SpanMapFeature.DocumentHighlights
	| SpanMapFeature.Rename
	| SpanMapFeature.CallHierarchy
	| SpanMapFeature.CodeActions
	| SpanMapFeature.LinkedEditing;
const languageFeatureMask = (SpanMapFeature.CodeLens << 1) - 1;

interface Candidate {
	generatedStart: number;
	generatedEnd: number;
	originalStart: number;
	originalEnd: number;
	kind: SpanMapKind;
	features: number;
	verified: boolean;
}

interface IntervalNode {
	start: number;
	end: number;
	maxEnd: number;
	priority: number;
	left?: IntervalNode;
	right?: IntervalNode;
}

export function toSpanMappings(
	mappings: readonly Mapping[],
	generatedText: string,
	originalText: string,
	languageFeatures = true,
	/** Receives virtual ranges that are mapped without verification and must not report diagnostics. */
	unverifiedRanges: [start: number, end: number][] = [],
): SpanMapping[] {
	const candidates: Candidate[] = [];
	const fills: Candidate[] = [];

	for (const [generatedStart, generatedLength, originalStart, originalLength, kind, data] of mappings) {
		const generatedEnd = generatedStart + generatedLength;
		const originalEnd = originalStart + originalLength;
		if (
			generatedStart < 0
			|| originalStart < 0
			|| generatedEnd > generatedText.length
			|| originalEnd > originalText.length
		) {
			continue;
		}
		const verbatim = kind === VolarSpanMapKind.Verbatim
			&& generatedLength === originalLength
			&& generatedText.slice(generatedStart, generatedEnd) === originalText.slice(originalStart, originalEnd);
		const sourceFeatures = data & languageFeatureMask;
		let features = languageFeatures ? sourceFeatures : 0;
		if (generatedLength === 0) {
			// Zero-length spans only serve as navigation anchors (e.g. the synthetic
			// default export) and completion points (e.g. an empty slot name).
			features &= navigationFeatures | completionFeatures;
			if (!features) {
				continue;
			}
		}
		const candidate: Candidate = {
			generatedStart,
			generatedEnd,
			originalStart,
			originalEnd,
			kind: verbatim ? SpanMapKind.Verbatim : SpanMapKind.Atom,
			features,
			verified: !!(data & VolarSpanMapFeature.Verification),
		};
		// A feature-less atom (e.g. a verification boundary around a props object)
		// only carries diagnostics; let the segments inside it win.
		// Decide by the source features so this holds without language features too.
		if (!sourceFeatures && kind !== VolarSpanMapKind.Verbatim) {
			fills.push(candidate);
		}
		else {
			candidates.push(candidate);
		}
	}

	splitAtNavigationCopies(candidates);

	candidates.sort((left, right) =>
		left.kind - right.kind
		|| left.generatedStart - right.generatedStart
		|| (left.generatedEnd - left.generatedStart) - (right.generatedEnd - right.generatedStart)
	);

	const selected: Candidate[] = [];
	const generatedIntervals = new IntervalSet(false);
	const originalIntervals = new IntervalSet(true);
	for (const candidate of candidates) {
		if (!generatedIntervals.canAdd(candidate.generatedStart, candidate.generatedEnd)) {
			continue;
		}
		if (!originalIntervals.canAdd(candidate.originalStart, candidate.originalEnd)) {
			continue;
		}
		generatedIntervals.add(candidate.generatedStart, candidate.generatedEnd);
		originalIntervals.add(candidate.originalStart, candidate.originalEnd);
		selected.push(candidate);
		if (!candidate.verified) {
			unverifiedRanges.push([candidate.generatedStart, candidate.generatedEnd]);
		}
	}

	// Fill the uncovered parts of each feature-less token with pieces of the
	// same original span, innermost first, so diagnostics still map to it.
	// The host orders segments by virtual start alone, so no piece may start where
	// a zero-length segment does.
	const zeroLengthStarts = new Set(
		selected.filter(mapping => mapping.generatedStart === mapping.generatedEnd).map(mapping => mapping.generatedStart),
	);
	fills.sort((left, right) => (left.generatedEnd - left.generatedStart) - (right.generatedEnd - right.generatedStart));
	for (const fill of fills) {
		if (!originalIntervals.canAdd(fill.originalStart, fill.originalEnd)) {
			continue;
		}
		const inner = selected
			.filter(mapping =>
				rangesOverlap(fill.generatedStart, fill.generatedEnd, mapping.generatedStart, mapping.generatedEnd)
			)
			.sort((left, right) => left.generatedStart - right.generatedStart);
		const pieces: Candidate[] = [];
		let start = fill.generatedStart;
		for (const mapping of [...inner, { generatedStart: fill.generatedEnd, generatedEnd: fill.generatedEnd }]) {
			if (start < mapping.generatedStart && !zeroLengthStarts.has(start)) {
				pieces.push({ ...fill, generatedStart: start, generatedEnd: mapping.generatedStart });
			}
			start = Math.max(start, mapping.generatedEnd);
		}
		if (!pieces.length) {
			continue;
		}
		for (const piece of pieces) {
			generatedIntervals.add(piece.generatedStart, piece.generatedEnd);
			selected.push(piece);
			if (!fill.verified) {
				unverifiedRanges.push([piece.generatedStart, piece.generatedEnd]);
			}
		}
		originalIntervals.add(fill.originalStart, fill.originalEnd);
	}

	selected.sort((left, right) => left.generatedStart - right.generatedStart);
	return selected.map(mapping => [
		mapping.generatedStart,
		mapping.generatedEnd - mapping.generatedStart,
		mapping.originalStart,
		mapping.originalEnd - mapping.originalStart,
		mapping.kind,
		mapping.features,
	]);
}

// Navigation copies of code (the runtime props object repeated in `defineComponent`,
// a `defineModel` name in the model props type, a scoped class name in a `:class`
// string) lie inside the verbatim section they were copied from. Original spans
// may not contain one another, so cut that section at each copy's bounds to make
// the spans identical.
function splitAtNavigationCopies(candidates: Candidate[]) {
	const copies = candidates.filter(candidate =>
		candidate.kind === SpanMapKind.Verbatim
		&& candidate.originalStart < candidate.originalEnd
		&& candidate.features
		&& !(candidate.features & ~(navigationFeatures | completionFeatures))
	);
	if (!copies.length) {
		return;
	}
	for (let index = candidates.length - 1; index >= 0; index--) {
		const section = candidates[index]!;
		if (section.kind !== SpanMapKind.Verbatim) {
			continue;
		}
		const cuts = new Set<number>();
		for (const copy of copies) {
			if (
				copy.originalStart >= section.originalStart
				&& copy.originalEnd <= section.originalEnd
				&& copy.originalEnd - copy.originalStart < section.originalEnd - section.originalStart
			) {
				cuts.add(copy.originalStart);
				cuts.add(copy.originalEnd);
			}
		}
		cuts.delete(section.originalStart);
		cuts.delete(section.originalEnd);
		if (!cuts.size) {
			continue;
		}
		const offset = section.generatedStart - section.originalStart;
		const bounds = [section.originalStart, ...[...cuts].sort((left, right) => left - right), section.originalEnd];
		const pieces = bounds.slice(1).map((end, i): Candidate => ({
			...section,
			generatedStart: bounds[i]! + offset,
			generatedEnd: end + offset,
			originalStart: bounds[i]!,
			originalEnd: end,
		}));
		candidates.splice(index, 1, ...pieces);
	}
}

function rangesOverlap(startA: number, endA: number, startB: number, endB: number) {
	return startA < endB && startB < endA;
}

class IntervalSet {
	#allowExactDuplicates: boolean;
	#exact = new Set<string>();
	#root: IntervalNode | undefined;

	constructor(allowExactDuplicates: boolean) {
		this.#allowExactDuplicates = allowExactDuplicates;
	}

	canAdd(start: number, end: number) {
		if (this.#allowExactDuplicates && this.#exact.has(toKey(start, end))) {
			return true;
		}
		return !hasOverlap(this.#root, start, end);
	}

	add(start: number, end: number) {
		const key = toKey(start, end);
		if (this.#allowExactDuplicates && this.#exact.has(key)) {
			return;
		}
		this.#exact.add(key);
		this.#root = insert(this.#root, {
			start,
			end,
			maxEnd: end,
			priority: hashInterval(start, end),
		});
	}
}

function hasOverlap(node: IntervalNode | undefined, start: number, end: number): boolean {
	if (!node) {
		return false;
	}
	if (node.left && node.left.maxEnd > start && hasOverlap(node.left, start, end)) {
		return true;
	}
	if (rangesOverlap(start, end, node.start, node.end)) {
		return true;
	}
	return node.start < end && hasOverlap(node.right, start, end);
}

function insert(root: IntervalNode | undefined, node: IntervalNode): IntervalNode {
	if (!root) {
		return node;
	}
	if (compareIntervals(node, root) < 0) {
		root.left = insert(root.left, node);
		if (root.left.priority < root.priority) {
			root = rotateRight(root);
		}
	}
	else {
		root.right = insert(root.right, node);
		if (root.right.priority < root.priority) {
			root = rotateLeft(root);
		}
	}
	root.maxEnd = Math.max(root.end, root.left?.maxEnd ?? 0, root.right?.maxEnd ?? 0);
	return root;
}

function rotateLeft(root: IntervalNode) {
	const next = root.right!;
	root.right = next.left;
	next.left = root;
	root.maxEnd = Math.max(root.end, root.left?.maxEnd ?? 0, root.right?.maxEnd ?? 0);
	next.maxEnd = Math.max(next.end, next.left.maxEnd, next.right?.maxEnd ?? 0);
	return next;
}

function rotateRight(root: IntervalNode) {
	const next = root.left!;
	root.left = next.right;
	next.right = root;
	root.maxEnd = Math.max(root.end, root.left?.maxEnd ?? 0, root.right?.maxEnd ?? 0);
	next.maxEnd = Math.max(next.end, next.left?.maxEnd ?? 0, next.right.maxEnd);
	return next;
}

function compareIntervals(left: IntervalNode, right: IntervalNode) {
	return left.start - right.start || left.end - right.end;
}

function hashInterval(start: number, end: number) {
	let result = 2166136261;
	result = Math.imul(result ^ start, 16777619);
	result = Math.imul(result ^ end, 16777619);
	return result >>> 0;
}

function toKey(start: number, end: number) {
	return `${start}:${end}`;
}
