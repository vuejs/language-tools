import { expect, test } from 'vitest';
import { getUnusedExpectErrorMessage, unusedExpectErrorMessages } from '../lib/result/unusedExpectErrorMessages';

test('localizes unused expect-error diagnostics', () => {
	expect(getUnusedExpectErrorMessage('ja')).toBe(
		"'@vue-expect-error' ディレクティブが使用されていません。",
	);
	expect(getUnusedExpectErrorMessage('zh-Hans')).toBe(
		'未使用的 "@vue-expect-error" 指令。',
	);
	expect(getUnusedExpectErrorMessage('zh-Hant')).toBe(
		"未使用的 '@vue-expect-error' 指示詞。",
	);
	expect(getUnusedExpectErrorMessage('pt-PT')).toContain(
		"'@vue-expect-error'",
	);
});

test('falls back to English for unsupported locales', () => {
	expect(getUnusedExpectErrorMessage('en-US')).toBe(
		"Unused '@vue-expect-error' directive.",
	);
	expect(getUnusedExpectErrorMessage(undefined)).toBe(
		"Unused '@vue-expect-error' directive.",
	);
});

test('every locale names the Vue directive the user wrote', () => {
	const locales = Object.keys(unusedExpectErrorMessages);
	expect(locales.length).toBeGreaterThan(0);
	for (const locale of [undefined, ...locales]) {
		const message = getUnusedExpectErrorMessage(locale);
		expect(message).toContain('@vue-expect-error');
		expect(message).not.toContain('@ts-expect-error');
	}
});
