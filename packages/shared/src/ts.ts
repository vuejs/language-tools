import type * as ts from 'typescript';

export function createTsLanguageService(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	ShPlugin: typeof import('typescript-vscode-sh-plugin'),
	_host: ts.LanguageServiceHost,
) {
	// @ts-ignore
	const importSuggestionsCache = ts.Completions?.createImportSuggestionsForFileCache?.();
	const host = {
		..._host,
		// @ts-ignore
		// TODO: crash on 'addListener' from 'node:process', reuse because TS has same problem
		getImportSuggestionsCache: () => importSuggestionsCache,
	};
	const shPlugin = ShPlugin({ typescript: ts });
	let languageService = ts.createLanguageService(host);
	languageService = shPlugin.decorate(languageService);
	return languageService;
}
