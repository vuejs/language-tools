import * as fs from 'node:fs';
import * as path from 'node:path';

const unusedExpectErrorKey = 'Unused_ts_expect_error_directive_2578';
const defaultUnusedExpectErrorMessage = "Unused '@ts-expect-error' directive.";
const supportedLocaleDirectories = [
	'cs',
	'de',
	'es',
	'fr',
	'it',
	'ja',
	'ko',
	'pl',
	'pt-br',
	'ru',
	'tr',
	'zh-cn',
	'zh-tw',
];

export function getUnusedExpectErrorMessage(
	locale: string | undefined,
	typescriptPath: string | undefined,
) {
	if (!locale) {
		return defaultUnusedExpectErrorMessage;
	}
	const libDirectory = typescriptPath
		? path.dirname(typescriptPath)
		: path.dirname(require.resolve('typescript'));
	const candidate = resolveLocaleDirectory(locale);
	if (candidate) {
		const fileName = path.join(libDirectory, candidate, 'diagnosticMessages.generated.json');
		if (fs.existsSync(fileName)) {
			const messages = JSON.parse(fs.readFileSync(fileName, 'utf8'));
			const message = messages[unusedExpectErrorKey];
			if (typeof message === 'string') {
				return message;
			}
		}
	}
	return defaultUnusedExpectErrorMessage;
}

function resolveLocaleDirectory(locale: string) {
	const [canonical] = Intl.getCanonicalLocales(locale.replace(/_/g, '-'));
	if (!canonical) {
		return;
	}
	const requested = new Intl.Locale(canonical).maximize();
	let languageMatch: string | undefined;
	for (const candidate of supportedLocaleDirectories) {
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
