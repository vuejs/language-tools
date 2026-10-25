import { createIgnoreDirectives } from './lib/buildMappings';
import { type DiagnosticDirectiveMapping, DiagnosticDirectivePolicy, type SpanMapping } from './protocol';

export function withSynthesizedDiagnosticIgnores(
	virtualLength: number,
	mappings: readonly SpanMapping[],
	directives: readonly DiagnosticDirectiveMapping[],
) {
	const unmapped: [start: number, end: number][] = [];
	let virtualStart = 0;
	for (const [start, length] of mappings) {
		if (length) {
			if (virtualStart < start) {
				unmapped.push([virtualStart, start]);
			}
			virtualStart = start + length;
		}
	}
	if (virtualStart < virtualLength) {
		unmapped.push([virtualStart, virtualLength]);
	}

	const result = [...directives, ...createIgnoreDirectives(unmapped, directives)];
	result.sort((left, right) => left[2] - right[2] || left[3] - right[3]);
	return mergeSynthesizedIgnores(result);
}

function mergeSynthesizedIgnores(directives: DiagnosticDirectiveMapping[]) {
	const result: DiagnosticDirectiveMapping[] = [];
	for (const directive of directives) {
		const previous = result.at(-1);
		if (previous && isSynthesizedIgnore(previous) && isSynthesizedIgnore(directive) && previous[3] === directive[2]) {
			result[result.length - 1] = [0, 0, previous[2], directive[3], DiagnosticDirectivePolicy.Ignore];
		}
		else {
			result.push(directive);
		}
	}
	return result;
}

function isSynthesizedIgnore(directive: DiagnosticDirectiveMapping) {
	return directive[4] === DiagnosticDirectivePolicy.Ignore && !directive[0] && !directive[1];
}
