import type * as ts from 'typescript';

let currentProjectVersion = -1;
let currentFileName = '';
let currentSnapshot: ts.IScriptSnapshot | undefined;
let languageService: ts.LanguageService | undefined;

const host: ts.LanguageServiceHost = {
	getProjectVersion: () => currentProjectVersion.toString(),
	getScriptFileNames: () => [currentFileName],
	getScriptVersion: () => currentProjectVersion.toString(),
	getScriptSnapshot: fileName => fileName === currentFileName ? currentSnapshot : undefined,
	getCompilationSettings: () => ({
		allowJs: true,
	}),
	getCurrentDirectory: () => '',
	getDefaultLibFileName: () => '',
	readFile: () => undefined,
	fileExists: fileName => fileName === currentFileName,
};

// TODO: share with volar-service-typescript
export function getLanguageService(ts: typeof import('typescript'), snapshot: ts.IScriptSnapshot, languageId: string) {
	if (currentSnapshot !== snapshot) {
		currentSnapshot = snapshot;
		currentFileName = '/tmp.' + (
			languageId === 'javascript'
				? 'js'
				: languageId === 'typescriptreact'
				? 'tsx'
				: languageId === 'javascriptreact'
				? 'jsx'
				: 'ts'
		);
		currentProjectVersion++;
	}
	languageService ??= ts.createLanguageService(host);
	return {
		languageService,
		fileName: currentFileName,
	};
}
