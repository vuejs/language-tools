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

interface RawEntry {
	generatedStart: number;
	generatedLength: number;
	originalStart: number;
	originalLength: number;
	data: Mapping['data'];
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
	const entries: (RawEntry & { token?: symbol })[] = [];

	for (const mapping of mappings) {
		for (let index = 0; index < mapping.lengths.length; index++) {
			const generatedStart = mapping.generatedOffsets[index];
			const originalStart = mapping.sourceOffsets[index];
			const length = mapping.lengths[index];
			if (
				generatedStart === undefined
				|| originalStart === undefined
				|| length === undefined
				|| length < 0
				|| generatedStart < 0
				|| originalStart < 0
			) {
				continue;
			}
			entries.push({
				generatedStart,
				generatedLength: length,
				originalStart,
				originalLength: length,
				data: mapping.data,
				token: getCombineToken(mapping.data),
			});
		}
	}

	// Mappings sharing a multi-use __combineToken are chunks of one logical
	// token: camelized identifiers split into segments, or content wrapped in
	// synthesized characters (quotes, escapes, `on` prefixes) bracketed by
	// zero-length boundary markers. Merge each group into a single span so
	// token-wide diagnostics map back to the original range, matching the
	// mapping combiner in the vue-tsc pipeline. A token used only once is
	// decoration (e.g. single-segment camelized names) and stays individual.
	const tokenCounts = new Map<symbol, number>();
	for (const entry of entries) {
		if (entry.token !== undefined) {
			tokenCounts.set(entry.token, (tokenCounts.get(entry.token) ?? 0) + 1);
		}
	}
	const combineGroups = new Map<symbol, typeof entries>();
	for (const entry of entries) {
		if (entry.token !== undefined && tokenCounts.get(entry.token)! > 1) {
			const group = combineGroups.get(entry.token);
			if (group) {
				group.push(entry);
			}
			else {
				combineGroups.set(entry.token, [entry]);
			}
		}
	}
	for (const group of combineGroups.values()) {
		group.sort((left, right) => left.generatedStart - right.generatedStart);
		const first = group[0]!;
		const last = group[group.length - 1]!;
		entries.push({
			generatedStart: first.generatedStart,
			generatedLength: last.generatedStart + last.generatedLength - first.generatedStart,
			originalStart: first.originalStart,
			originalLength: last.originalStart + last.originalLength - first.originalStart,
			data: first.data,
		});
	}
	const grouped = new Set([...combineGroups.values()].flat());

	for (const entry of entries) {
		if (grouped.has(entry)) {
			continue;
		}
		const { generatedStart, generatedLength, originalStart, originalLength, data } = entry;
		if (
			generatedStart + generatedLength > generatedText.length
			|| originalStart + originalLength > originalText.length
		) {
			continue;
		}

		const generatedEnd = generatedStart + generatedLength;
		const originalEnd = originalStart + originalLength;
		const verbatim = generatedLength === originalLength
			&& generatedText.slice(generatedStart, generatedEnd)
				=== originalText.slice(originalStart, originalEnd);
		let features = languageFeatures ? getFeatures(data) : 0;
		if (generatedLength === 0) {
			// Zero-length spans only serve as navigation anchors (e.g. the synthetic
			// default export); drop boundary scaffolding and other zero-length markers.
			if (typeof data !== 'object' || data === null || '__combineToken' in data) {
				continue;
			}
			features &= navigationFeatures;
			if (!features) {
				continue;
			}
		}
		candidates.push({
			generatedStart,
			generatedEnd,
			originalStart,
			originalEnd,
			kind: verbatim ? SpanMapKind.Verbatim : SpanMapKind.Atom,
			features,
		});
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

function getCombineToken(data: Mapping['data']): symbol | undefined {
	if (typeof data === 'object' && data !== null && '__combineToken' in data) {
		const token = (data as { __combineToken: unknown }).__combineToken;
		if (typeof token === 'symbol') {
			return token;
		}
	}
	return undefined;
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
