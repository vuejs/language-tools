import * as path from 'node:path';
import { expect, test } from 'vitest';
import { withSynthesizedDiagnosticIgnores } from '../diagnosticDirectives';
import { type DiagnosticDirectiveMapping, DiagnosticDirectivePolicy, SpanMapKind, type SpanMapping } from '../protocol';
import { normalizeCompilerOutput, repositoryRoot, runTsc } from './utils';

test('reports an unused @vue-expect-error by the directive name the user wrote', () => {
	const result = runTsc([
		'-p',
		path.join(repositoryRoot, 'test-workspace/tsc/_failed_vueIgnoreScope/tsconfig.json'),
		'--noEmit',
		'--runExternalCode',
		'--pretty',
		'false',
	]);
	const lines = normalizeCompilerOutput(result).replaceAll('\\', '/').split('\n');
	expect(lines.filter(line => line.includes('2578'))).toEqual([
		"test-workspace/tsc/_failed_vueIgnoreScope/main.vue(45,2): error vue2578: Unused '@vue-expect-error' directive.",
	]);
});

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

test('merges synthesized ignores with the ignores of mapped regions', () => {
	const mappings: SpanMapping[] = [
		[0, 2, 0, 2, SpanMapKind.Verbatim, 0],
		[4, 2, 0, 2, SpanMapKind.Verbatim, 0],
	];

	expect(withSynthesizedDiagnosticIgnores(6, mappings, [[0, 0, 4, 6, DiagnosticDirectivePolicy.Ignore]])).toEqual([
		[0, 0, 2, 6, DiagnosticDirectivePolicy.Ignore],
	]);
});
