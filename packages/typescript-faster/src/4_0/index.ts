export default function (
	ts: typeof import('typescript/lib/tsserverlibrary'),
	host: ts.LanguageServiceHost,
	service: ts.LanguageService,
) {
	// @ts-expect-error
	const importSuggestionsCache = ts.Completions?.createImportSuggestionsForFileCache?.();
	// @ts-expect-error
	// TODO: crash on 'addListener' from 'node:process', reuse because TS has same problem
	host.getImportSuggestionsCache = () => importSuggestionsCache;
}
