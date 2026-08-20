import type { Mapping } from '@vue/language-core';
import { SpanMapFeature, SpanMapKind, type SpanMapping } from './protocol';

const semanticFeatures = SpanMapFeature.Hover
	| SpanMapFeature.SignatureHelp
	| SpanMapFeature.InlayHints
	| SpanMapFeature.SemanticTokens;
const completionFeatures = SpanMapFeature.Completion
	| SpanMapFeature.AutoInsert;
const navigationFeatures = SpanMapFeature.Definition
	| SpanMapFeature.TypeDefinition
	| SpanMapFeature.Implementation
	| SpanMapFeature.SourceDefinition
	| SpanMapFeature.References
	| SpanMapFeature.DocumentHighlights
	| SpanMapFeature.Rename
	| SpanMapFeature.CallHierarchy
	| SpanMapFeature.CodeActions
	| SpanMapFeature.LinkedEditing;
const structureFeatures = SpanMapFeature.FoldingRanges
	| SpanMapFeature.SelectionRanges
	| SpanMapFeature.DocumentSymbols
	| SpanMapFeature.CodeLens;

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
	mappings: readonly Mapping[],
	generatedText: string,
	originalText: string,
	languageFeatures = true,
): SpanMapping[] {
	const candidates: Candidate[] = [];

	for (const mapping of mappings) {
		for (let index = 0; index < mapping.lengths.length; index++) {
			const generatedStart = mapping.generatedOffsets[index];
			const originalStart = mapping.sourceOffsets[index];
			const length = mapping.lengths[index];
			if (
				generatedStart === undefined
				|| originalStart === undefined
				|| length === undefined
				|| length <= 0
				|| generatedStart < 0
				|| originalStart < 0
				|| generatedStart + length > generatedText.length
				|| originalStart + length > originalText.length
			) {
				continue;
			}

			const generatedEnd = generatedStart + length;
			const originalEnd = originalStart + length;
			const verbatim = generatedText.slice(generatedStart, generatedEnd)
				=== originalText.slice(originalStart, originalEnd);
			candidates.push({
				generatedStart,
				generatedEnd,
				originalStart,
				originalEnd,
				kind: verbatim ? SpanMapKind.Verbatim : SpanMapKind.Atom,
				features: languageFeatures ? getFeatures(mapping.data) : 0,
			});
		}
	}

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

function getFeatures(data: Mapping['data']) {
	if (!isCodeInformation(data)) {
		return 0;
	}
	let features = 0;
	if (data.semantic) {
		features |= semanticFeatures;
		if (
			typeof data.semantic === 'object'
			&& data.semantic.shouldHighlight?.() === false
		) {
			features &= ~SpanMapFeature.SemanticTokens;
		}
	}
	if (data.completion) {
		features |= completionFeatures;
	}
	if (data.navigation) {
		features |= navigationFeatures;
		if (typeof data.navigation === 'object') {
			if (data.navigation.shouldHighlight?.() === false) {
				features &= ~SpanMapFeature.DocumentHighlights;
			}
			if (data.navigation.shouldRename?.() === false) {
				features &= ~SpanMapFeature.Rename;
			}
		}
	}
	if (data.structure) {
		features |= structureFeatures;
	}
	if (data.format) {
		features |= SpanMapFeature.Formatting;
	}
	return features;
}

function isCodeInformation(value: unknown): value is {
	semantic?: boolean | {
		shouldHighlight?(): boolean;
	};
	completion?: unknown;
	navigation?: boolean | {
		shouldHighlight?(): boolean;
		shouldRename?(): boolean;
	};
	structure?: unknown;
	format?: unknown;
} {
	return typeof value === 'object' && value !== null;
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
