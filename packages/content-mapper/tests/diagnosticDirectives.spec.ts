import { expect, test } from 'vitest';
import { withSynthesizedDiagnosticIgnores } from '../diagnosticDirectives';
import { toDiagnosticDirectives } from '../diagnosticDirectives';
import { type DiagnosticDirectiveMapping, SpanMapKind, type SpanMapping } from '../protocol';

test('ignores synthesized virtual regions without overlapping explicit directives', () => {
	const mappings: SpanMapping[] = [
		[2, 2, 0, 2, SpanMapKind.Verbatim, 0],
		[6, 2, 2, 2, SpanMapKind.Verbatim, 0],
	];
	const expectation: DiagnosticDirectiveMapping = {
		originalStart: 0,
		originalLength: 1,
		virtualStart: 5,
		virtualLength: 2,
		policy: 'expect',
		unusedDiagnostic: {
			code: 2578,
			messageText: "Unused '@ts-expect-error' directive.",
		},
	};

	expect(withSynthesizedDiagnosticIgnores(10, mappings, [expectation])).toEqual([
		{
			originalStart: 0,
			originalLength: 0,
			virtualStart: 0,
			virtualLength: 2,
			policy: 'ignore',
		},
		{
			originalStart: 0,
			originalLength: 0,
			virtualStart: 4,
			virtualLength: 1,
			policy: 'ignore',
		},
		expectation,
		{
			originalStart: 0,
			originalLength: 0,
			virtualStart: 8,
			virtualLength: 2,
			policy: 'ignore',
		},
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

	expect(result).toMatchObject({
		originalStart: 5,
		virtualStart: 10,
		virtualLength: 30,
		policy: 'expect',
	});
});
