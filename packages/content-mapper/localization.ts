const defaultUnusedExpectErrorMessage = "Unused '@ts-expect-error' directive.";
// TypeScript 7 ships its messages inside the compiler binary, so these are copied from TypeScript's
// `diagnosticMessages.generated.json` (`Unused_ts_expect_error_directive_2578`).
const unusedExpectErrorMessages: Record<string, string> = {
	'cs': 'Nepoužitá direktiva @ts-expect-error',
	'de': 'Nicht verwendete @ts-expect-error-Direktive.',
	'es': 'Directiva "@ts-expect-error" no usada.',
	'fr': "Directive '@ts-expect-error' inutilisée.",
	'it': "Direttiva '@ts-expect-error' non usata.",
	'ja': "'@ts-expect-error' ディレクティブが使用されていません。",
	'ko': "사용되지 않는 '@ts-expect-error' 지시문입니다.",
	'pl': 'Nieużywana dyrektywa „@ts-expect-error”.',
	'pt-br': "Diretiva '@ts-expect-error' não usada.",
	'ru': 'Неиспользуемая директива "@ts-expect-error".',
	'tr': "Kullanılmayan '@ts-expect-error' yönergesi.",
	'zh-cn': '未使用的 "@ts-expect-error" 指令。',
	'zh-tw': "未使用的 '@ts-expect-error' 指示詞。",
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
