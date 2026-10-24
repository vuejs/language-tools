import { expect, test } from 'vitest';
import { withSynthesizedDiagnosticIgnores } from '../diagnosticDirectives';
import { toDiagnosticDirectives } from '../diagnosticDirectives';
import { type DiagnosticDirectiveMapping, DiagnosticDirectivePolicy, SpanMapKind, type SpanMapping } from '../protocol';

test('ignores synthesized virtual regions without overlapping explicit directives', () => {
	const mappings: SpanMapping[] = [
		[2, 2, 0, 2, SpanMapKind.Verbatim, 0],
		[6, 2, 2, 2, SpanMapKind.Verbatim, 0],
	];
	const expectation: DiagnosticDirectiveMapping = [0, 1, 5, 7, DiagnosticDirectivePolicy.Expect];

	expect(withSynthesizedDiagnosticIgnores(10, mappings, [expectation])).toEqual([
		[0, 0, 0, 2, DiagnosticDirectivePolicy.Ignore],
		[0, 0, 4, 5, DiagnosticDirectivePolicy.Ignore],
		expectation,
		[0, 0, 8, 10, DiagnosticDirectivePolicy.Ignore],
	]);
});

test('ignores mapped regions whose diagnostics the code ignores', () => {
	const mappings: SpanMapping[] = [
		[0, 2, 0, 2, SpanMapKind.Verbatim, 0],
		[4, 2, 0, 2, SpanMapKind.Verbatim, 0],
	];

	expect(withSynthesizedDiagnosticIgnores(6, mappings, [], [[4, 6]])).toEqual([
		[0, 0, 2, 6, DiagnosticDirectivePolicy.Ignore],
	]);
});

test('starts expectations at the node anchor', () => {
	const directive = {
		policy: 'expect' as const,
		originalLength: 10,
	};
	const [result] = toDiagnosticDirectives([
		{ directive, phase: 'anchor', generatedStart: 10, generatedLength: 0, sourceStart: 5 },
		{ directive, phase: 'content', generatedStart: 30, generatedLength: 5, sourceStart: 20 },
		{ directive, phase: 'end', generatedStart: 40, generatedLength: 0, sourceStart: 5 },
	]);

	expect(result).toEqual([5, 10, 10, 40, DiagnosticDirectivePolicy.Expect]);
});

test('ignores the node code from the anchor to the end and its content after the end', () => {
	const directive = { policy: 'ignore' as const, originalLength: 10 };
	expect(toDiagnosticDirectives([
		{ directive, phase: 'anchor', generatedStart: 10, generatedLength: 0, sourceStart: 5 },
		{ directive, phase: 'content', generatedStart: 30, generatedLength: 5, sourceStart: 20 },
		{ directive, phase: 'end', generatedStart: 40, generatedLength: 0, sourceStart: 5 },
		{ directive, phase: 'content', generatedStart: 50, generatedLength: 5, sourceStart: 25 },
	])).toEqual([
		[5, 10, 10, 40, DiagnosticDirectivePolicy.Ignore],
		[5, 10, 50, 55, DiagnosticDirectivePolicy.Ignore],
	]);
});

test('orders an empty expectation before an ignore starting at the same anchor', () => {
	const ignore = { policy: 'ignore' as const, originalLength: 10 };
	const expectation = { policy: 'expect' as const, originalLength: 10 };
	expect(toDiagnosticDirectives([
		{ directive: ignore, phase: 'anchor', generatedStart: 10, generatedLength: 0, sourceStart: 5 },
		{ directive: expectation, phase: 'anchor', generatedStart: 10, generatedLength: 0, sourceStart: 20 },
		{ directive: ignore, phase: 'end', generatedStart: 40, generatedLength: 0, sourceStart: 5 },
	])).toEqual([
		[20, 10, 10, 10, DiagnosticDirectivePolicy.Expect],
		[5, 10, 10, 40, DiagnosticDirectivePolicy.Ignore],
	]);
});
