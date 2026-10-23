import { expect, test } from 'vitest';
import { getUnusedExpectErrorMessage } from '../localization';

test('localizes unused expect-error diagnostics', () => {
	expect(getUnusedExpectErrorMessage('ja')).toBe(
		"'@ts-expect-error' ディレクティブが使用されていません。",
	);
	expect(getUnusedExpectErrorMessage('zh-Hans')).toBe(
		'未使用的 "@ts-expect-error" 指令。',
	);
	expect(getUnusedExpectErrorMessage('zh-Hant')).toBe(
		"未使用的 '@ts-expect-error' 指示詞。",
	);
	expect(getUnusedExpectErrorMessage('pt-PT')).toContain(
		"'@ts-expect-error'",
	);
});

test('falls back to English for unsupported locales', () => {
	expect(getUnusedExpectErrorMessage('en-US')).toBe(
		"Unused '@ts-expect-error' directive.",
	);
	expect(getUnusedExpectErrorMessage(undefined)).toBe(
		"Unused '@ts-expect-error' directive.",
	);
});
