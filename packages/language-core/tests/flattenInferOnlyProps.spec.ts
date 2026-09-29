import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { flattenInferOnlyProps } from '../lib/codegen/utils/flattenInferOnlyProps';

describe('flattenInferOnlyProps', () => {
	it('keeps a line comment from swallowing the rest of the joined constructor call', () => {
		const input = [
			'foo:',
			'  // a comment',
			`  'x',`,
			'}',
		].join('\n');

		const out = flattenInferOnlyProps(ts, input);

		expect(out.includes('\n')).toBe(false);
		expect(out).toContain('/* a comment */');
		expect(out).toContain(`'x'`);
		expect(out.endsWith('}')).toBe(true);
		expect(out).not.toMatch(/\/\/ a comment/);
	});

	it('does not treat // inside a string as a comment', () => {
		const out = flattenInferOnlyProps(ts, `foo: 'http://example.com',\nbar: 1`);
		expect(out).toContain(`'http://example.com'`);
		expect(out).toContain('bar: 1');
	});
});
