import { allFeatures, completionFeatures, navigationFeatures, type SpanMapSegment } from '@vue/language-core';
import { fnv1a } from '../hash';
import { SpanMapKind, type SpanMapping } from '../protocol';

interface Candidate {
	generatedStart: number;
	generatedEnd: number;
	originalStart: number;
	originalEnd: number;
	kind: SpanMapKind;
	features: number;
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
	segments: readonly SpanMapSegment[],
	generatedText: string,
	originalText: string,
	languageFeatures = true,
): SpanMapping[] {
	const candidates: Candidate[] = [];
	const fills: Candidate[] = [];

	for (const segment of segments) {
		const { virtualStart: generatedStart, virtualEnd: generatedEnd, originalStart, originalEnd, kind } = segment;
		const generatedLength = generatedEnd - generatedStart;
		const originalLength = originalEnd - originalStart;
		if (
			generatedStart < 0
			|| originalStart < 0
			|| generatedEnd > generatedText.length
			|| originalEnd > originalText.length
		) {
			continue;
		}
		const verbatim = kind === SpanMapKind.Verbatim
			&& generatedLength === originalLength
			&& generatedText.slice(generatedStart, generatedEnd) === originalText.slice(originalStart, originalEnd);
		const sourceFeatures = (segment.features ?? allFeatures) & allFeatures;
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
		};
		// A feature-less atom (e.g. a boundary around a props object)
		// only carries diagnostics; let the segments inside it win.
		// Decide by the source features so this holds without language features too.
		if (!sourceFeatures && kind !== SpanMapKind.Verbatim) {
			fills.push(candidate);
		}
		else {
			candidates.push(candidate);
		}
	}

	candidates.sort((left, right) =>
		left.kind - right.kind
		|| left.generatedStart - right.generatedStart
		|| (left.generatedEnd - left.generatedStart) - (right.generatedEnd - right.generatedStart)
	);

	const selected: Candidate[] = [];
	const generatedIntervals = new IntervalSet();
	for (const candidate of candidates) {
		if (!generatedIntervals.canAdd(candidate.generatedStart, candidate.generatedEnd)) {
			continue;
		}
		generatedIntervals.add(candidate.generatedStart, candidate.generatedEnd);
		selected.push(candidate);
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
		}
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

function rangesOverlap(startA: number, endA: number, startB: number, endB: number) {
	return startA < endB && startB < endA;
}

class IntervalSet {
	#root: IntervalNode | undefined;

	canAdd(start: number, end: number) {
		return !hasOverlap(this.#root, start, end);
	}

	add(start: number, end: number) {
		this.#root = insert(this.#root, {
			start,
			end,
			maxEnd: end,
			priority: fnv1a([start, end]),
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
