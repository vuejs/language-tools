const defaultUnusedExpectErrorMessage = "Unused '@vue-expect-error' directive.";
// TypeScript 7 ships its messages inside the compiler binary, so these are copied from TypeScript's
// `diagnosticMessages.generated.json` (`Unused_ts_expect_error_directive_2578`), naming the Vue
// directive the user wrote instead of `@ts-expect-error`.
export const unusedExpectErrorMessages: Record<string, string> = {
	'cs': 'Nepoužitá direktiva @vue-expect-error',
	'de': 'Nicht verwendete @vue-expect-error-Direktive.',
	'es': 'Directiva "@vue-expect-error" no usada.',
	'fr': "Directive '@vue-expect-error' inutilisée.",
	'it': "Direttiva '@vue-expect-error' non usata.",
	'ja': "'@vue-expect-error' ディレクティブが使用されていません。",
	'ko': "사용되지 않는 '@vue-expect-error' 지시문입니다.",
	'pl': 'Nieużywana dyrektywa „@vue-expect-error”.',
	'pt-br': "Diretiva '@vue-expect-error' não usada.",
	'ru': 'Неиспользуемая директива "@vue-expect-error".',
	'tr': "Kullanılmayan '@vue-expect-error' yönergesi.",
	'zh-cn': '未使用的 "@vue-expect-error" 指令。',
	'zh-tw': "未使用的 '@vue-expect-error' 指示詞。",
};

export function getUnusedExpectErrorMessage(locale?: string) {
	const candidate = locale ? resolveLocaleDirectory(locale) : undefined;
	return candidate ? unusedExpectErrorMessages[candidate]! : defaultUnusedExpectErrorMessage;
}

function resolveLocaleDirectory(locale: string) {
	const [canonical] = Intl.getCanonicalLocales(locale.replace(/_/g, '-'));
	if (!canonical) {
		return;
	}
	const requested = new Intl.Locale(canonical).maximize();
	let languageMatch: string | undefined;
	for (const candidate of Object.keys(unusedExpectErrorMessages)) {
		const supported = new Intl.Locale(candidate).maximize();
		if (supported.language !== requested.language) {
			continue;
		}
		languageMatch ??= candidate;
		if (supported.script === requested.script) {
			return candidate;
		}
	}
	return languageMatch;
}
