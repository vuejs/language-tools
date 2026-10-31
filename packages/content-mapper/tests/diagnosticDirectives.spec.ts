import type { IR } from '@vue/language-core';
import * as path from 'node:path';
import { expect, test } from 'vitest';
import { mapped, synthesizedIgnore, type TsCode } from '../lib/codegen/tsCode';
import {
	type DiagnosticDirectiveMapping,
	DiagnosticDirectivePolicy,
	SpanMapKind,
	type SpanMapping,
} from '../lib/protocol';
import { getUnmappedRanges } from '../lib/result/transformResult';
import { buildDiagnosticDirectives } from '../lib/result/tsCodeMappings';
import { normalizeCompilerOutput, repositoryRoot, runTsc } from './utils';

const file = {} as IR;

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

test('leaves required props to fallthrough attributes but still checks the props passed', () => {
	const result = runTsc([
		'-p',
		path.join(repositoryRoot, 'test-workspace/content-mapper-fallthrough/tsconfig.json'),
		'--noEmit',
		'--runExternalCode',
		'--pretty',
		'false',
	]);
	expect(normalizeCompilerOutput(result).replaceAll('\\', '/')).toBe(
		"test-workspace/content-mapper-fallthrough/WrongTypeProp.vue(6,10): error TS2322: Type 'number' is not assignable to type 'string'.",
	);
});

test('ignores synthesized virtual regions without overlapping explicit directives', () => {
	const mappings: SpanMapping[] = [
		[2, 2, 0, 2, SpanMapKind.Verbatim, 0],
		[6, 2, 2, 2, SpanMapKind.Verbatim, 0],
	];
	const expectation: DiagnosticDirectiveMapping = [0, 1, 5, 7, DiagnosticDirectivePolicy.Expect];
	const chunks: TsCode[] = [
		'01234',
		mapped('', file, 0, { start: [0, 1, 0, 0, DiagnosticDirectivePolicy.Expect] }),
		'56',
		mapped('', file, 0, { end: true }),
		'789',
	];

	expect(buildDiagnosticDirectives(chunks, getUnmappedRanges(10, mappings))).toEqual([
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
	const chunks: TsCode[] = [
		'0123',
		mapped('', file, 0, { start: synthesizedIgnore }),
		'45',
		mapped('', file, 0, { end: true }),
	];

	expect(buildDiagnosticDirectives(chunks, getUnmappedRanges(6, mappings))).toEqual([
		[0, 0, 2, 6, DiagnosticDirectivePolicy.Ignore],
	]);
});

test('ignores replayed branch guards while checking source conditions and handlers', () => {
	const result = runTsc([
		'-p',
		path.join(repositoryRoot, 'test-workspace/content-mapper-condition-guards/tsconfig.json'),
		'--runExternalCode',
		'--pretty',
		'false',
	]);
	const output = normalizeCompilerOutput(result);
	expect(result.status).toBe(2);
	expect(output).not.toContain('/Valid.vue(');
	expect(output).toContain("Property 'toUpperCase' does not exist on type 'number'");
	expect(output).toContain("'__VLS_ctx.selected' is possibly 'null'");
	expect(output).toContain("Property 'toFixed' does not exist on type 'string'");
	expect(output).toContain('Expected 0 arguments, but got 1');
});
