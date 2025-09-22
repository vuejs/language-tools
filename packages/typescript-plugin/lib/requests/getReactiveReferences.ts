import { createProxyLanguageService, decorateLanguageServiceHost } from '@volar/typescript';
import { type Language, type SourceScript } from '@vue/language-core';
import { createAnalyzer } from 'laplacenoma';
import * as rulesVue from 'laplacenoma/rules/vue';
import type * as ts from 'typescript';

const analyzer = createAnalyzer({
	rules: rulesVue,
});

let currentVersion = -1;
let currentFileName = '';
let currentSnapshot: ts.IScriptSnapshot | undefined;
let languageService: ts.LanguageService | undefined;
let languageServiceHost: ts.LanguageServiceHost | undefined;

export function getReactiveReferences(
	ts: typeof import('typescript'),
	language: Language<string>,
	sourceScript: SourceScript<string>,
	fileName: string,
	position: number,
	leadingOffset: number = 0,
) {
	if (currentSnapshot !== sourceScript.snapshot || currentFileName !== sourceScript.id) {
		currentSnapshot = sourceScript.snapshot;
		currentFileName = sourceScript.id;
		currentVersion++;
	}
	if (!languageService) {
		languageServiceHost = {
			getProjectVersion: () => currentVersion.toString(),
			getScriptVersion: () => currentVersion.toString(),
			getScriptFileNames: () => [currentFileName],
			getScriptSnapshot: fileName => fileName === currentFileName ? currentSnapshot : undefined,
			getCompilationSettings: () => ({ allowJs: true, allowNonTsExtensions: true }),
			getCurrentDirectory: () => '',
			getDefaultLibFileName: () => '',
			readFile: () => undefined,
			fileExists: fileName => fileName === currentFileName,
		};
		decorateLanguageServiceHost(ts, language, languageServiceHost);
		const proxied = createProxyLanguageService(ts.createLanguageService(languageServiceHost));
		proxied.initialize(language);
		languageService = proxied.proxy;
	}

	const sourceFile = languageService.getProgram()!.getSourceFile(fileName)!;
	const serviceScript = sourceScript.generated?.languagePlugin.typescript?.getServiceScript(
		sourceScript.generated.root,
	);
	const map = serviceScript ? language.maps.get(serviceScript.code, sourceScript) : undefined;
	const toSourceRange = map
		? (pos: number, end: number) => {
			for (const [mappedStart, mappedEnd] of map.toSourceRange(pos - leadingOffset, end - leadingOffset, false)) {
				return { pos: mappedStart, end: mappedEnd };
			}
		}
		: (pos: number, end: number) => ({ pos, end });

	return analyzer.analyze(sourceFile, position, {
		typescript: ts,
		languageService,
		toSourceRange,
	});
}
