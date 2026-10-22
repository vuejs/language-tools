import * as path from 'node:path';
import { expect, test } from 'vitest';
import { getUnusedExpectErrorMessage } from '../localization';

const typescriptPath = require.resolve('typescript');

test('localizes unused expect-error diagnostics', () => {
	expect(getUnusedExpectErrorMessage('ja', typescriptPath)).toBe(
		"'@ts-expect-error' ディレクティブが使用されていません。",
	);
	expect(getUnusedExpectErrorMessage('zh-Hans', typescriptPath)).toBe(
		'未使用的 "@ts-expect-error" 指令。',
	);
	expect(getUnusedExpectErrorMessage('pt-PT', typescriptPath)).toContain(
		"'@ts-expect-error'",
	);
});

test('falls back to English for unsupported locales', () => {
	expect(getUnusedExpectErrorMessage('en-US', path.resolve('typescript.js'))).toBe(
		"Unused '@ts-expect-error' directive.",
	);
});
