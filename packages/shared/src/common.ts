export function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export function syntaxToLanguageId(syntax: string) {
	switch (syntax) {
		case 'js': return 'javascript';
		case 'cjs': return 'javascript';
		case 'mjs': return 'javascript';
		case 'ts': return 'typescript';
		case 'cts': return 'typescript';
		case 'mts': return 'typescript';
		case 'jsx': return 'javascriptreact';
		case 'tsx': return 'typescriptreact';
		case 'pug': return 'jade';
		case 'md': return 'markdown';
	}
	return syntax;
}

export function languageIdToSyntax(languageId: string) {
	switch (languageId) {
		case 'javascript': return 'js';
		case 'typescript': return 'ts';
		case 'javascriptreact': return 'jsx';
		case 'typescriptreact': return 'tsx';
		case 'jade': return 'pug';
		case 'markdown': return 'md';
	}
	return languageId;
}

export function notEmpty<T>(value: T | null | undefined): value is T {
	return value !== null && value !== undefined;
}
