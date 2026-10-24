import { expect, test } from 'vitest';
import { withSynthesizedDiagnosticIgnores } from '../diagnosticDirectives';
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
