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

test('starts expectations at the node anchor', () => {
	const directive = {
		policy: 'expect' as const,
		originalLength: 10,
	};
	const [result] = toDiagnosticDirectives([
		{
			sourceOffsets: [5],
			generatedOffsets: [10],
			lengths: [0],
			data: {
				__diagnosticDirective: {
					directive,
					phase: 'anchor',
				},
			},
		},
		{
			sourceOffsets: [20],
			generatedOffsets: [30],
			lengths: [5],
			data: {
				__diagnosticDirective: {
					directive,
					phase: 'content',
				},
			},
		},
		{
			sourceOffsets: [5],
			generatedOffsets: [40],
			lengths: [0],
			data: {
				__diagnosticDirective: {
					directive,
					phase: 'end',
				},
			},
		},
	]);

	expect(result).toEqual([5, 10, 10, 40, DiagnosticDirectivePolicy.Expect]);
});
