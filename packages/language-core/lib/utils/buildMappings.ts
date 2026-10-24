import { type Mapping, SpanMapFeature, SpanMapKind } from '@volar/language-core';
import type { Segment } from 'muggle-string';
import type { Code, VueCodeInformation, VueDiagnosticDirective } from '../types';

interface Entry {
	generatedStart: number;
	length: number;
	sourceStart: number;
	info: VueCodeInformation;
}

export interface DiagnosticDirectiveMarker extends VueDiagnosticDirective {
	generatedStart: number;
	generatedLength: number;
	sourceStart: number;
}

export function buildMappings(chunks: (Code | Segment)[]): Mapping[] {
	const entries = toEntries(chunks);
	const tokenCounts = new Map<symbol, number>();
	const shorthandRanges = new Set<string>();
	for (const { info, sourceStart, length } of entries) {
		if (typeof info === 'object') {
			if (info.atom) {
				tokenCounts.set(info.atom, (tokenCounts.get(info.atom) ?? 0) + 1);
			}
			if (info.kind === SpanMapKind.Atom) {
				shorthandRanges.add(`${sourceStart}:${sourceStart + length}`);
			}
		}
	}

	const mappings: (Mapping | Entry[])[] = [];
	const groups = new Map<symbol, Entry[]>();
	for (const entry of entries) {
		const { info } = entry;
		const atom = typeof info === 'object' ? info.atom : undefined;
		if (atom && tokenCounts.get(atom)! > 1) {
			let group = groups.get(atom);
			if (!group) {
				groups.set(atom, group = []);
				mappings.push(group);
			}
			group.push(entry);
		}
		else if (!atom || entry.length) {
			mappings.push(toMapping(entry));
		}
	}

	return mappings.flatMap(mapping => isGroup(mapping) ? fromGroup(mapping) : [mapping]);

	function fromGroup(group: Entry[]): Mapping[] {
		const first = group[0]!;
		const last = group[group.length - 1]!;
		const atom: Mapping = [
			first.generatedStart,
			last.generatedStart + last.length - first.generatedStart,
			first.sourceStart,
			last.sourceStart + last.length - first.sourceStart,
			isContiguous(group) ? SpanMapKind.Verbatim : SpanMapKind.Atom,
			getFeatures(first.info),
		];
		const content = group.length === 3 ? group[1]! : undefined;
		if (
			content
			&& !first.length
			&& !last.length
			&& content.sourceStart === atom[2]
			&& content.length === atom[3]
			&& getFeatures(content.info) & SpanMapFeature.Completion
		) {
			atom[5] &= SpanMapFeature.Verification;
			return [atom, toMapping(content)];
		}
		return [atom];
	}

	function toMapping({ generatedStart, length, sourceStart, info }: Entry): Mapping {
		const kind = typeof info === 'object' && info.kind !== undefined
			? info.kind
			: shorthandRanges.has(`${sourceStart}:${sourceStart + length}`)
			? SpanMapKind.Atom
			: SpanMapKind.Verbatim;
		return [generatedStart, length, sourceStart, length, kind, getFeatures(info)];
	}
}

export function buildDiagnosticDirectiveMarkers(chunks: Code[]) {
	const markers: DiagnosticDirectiveMarker[] = [];
	for (const { generatedStart, length, sourceStart, info } of toEntries(chunks)) {
		if (typeof info === 'object' && info.diagnosticDirective) {
			markers.push({
				...info.diagnosticDirective,
				generatedStart,
				generatedLength: length,
				sourceStart,
			});
		}
	}
	return markers;
}

function toEntries(chunks: (Code | Segment)[]) {
	const entries: Entry[] = [];
	let generatedStart = 0;
	for (const segment of chunks) {
		if (typeof segment === 'string') {
			generatedStart += segment.length;
		}
		else {
			entries.push({
				generatedStart,
				length: segment[0].length,
				sourceStart: segment[2],
				info: segment[3] ?? 0,
			});
			generatedStart += segment[0].length;
		}
	}
	return entries;
}

function isContiguous(group: Entry[]) {
	const first = group[0]!;
	let generatedEnd = first.generatedStart;
	for (const entry of group) {
		if (
			entry.generatedStart !== generatedEnd
			|| entry.sourceStart - first.sourceStart !== entry.generatedStart - first.generatedStart
		) {
			return false;
		}
		generatedEnd += entry.length;
	}
	return true;
}

function isGroup(mapping: Mapping | Entry[]): mapping is Entry[] {
	return typeof mapping[0] === 'object';
}

function getFeatures(info: VueCodeInformation) {
	return typeof info === 'number' ? info : info.features;
}
