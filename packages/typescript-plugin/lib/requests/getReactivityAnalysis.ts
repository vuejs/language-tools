/// <reference types="@volar/typescript" />

import { type Language, type SourceScript } from '@vue/language-core';
import { createAnalyzer } from 'laplacenoma';
import * as rulesVue from 'laplacenoma/rules/vue';
import type * as ts from 'typescript';

const analyzer = createAnalyzer({
	rules: rulesVue,
});

export function getReactivityAnalysis(
	ts: typeof import('typescript'),
	language: Language,
	languageService: ts.LanguageService,
	sourceScript: SourceScript | undefined,
	fileName: string,
	position: number,
	leadingOffset: number = 0,
) {
	const sourceFile = languageService.getProgram()!.getSourceFile(fileName)!;
	const serviceScript = sourceScript?.generated?.languagePlugin.typescript?.getServiceScript(
		sourceScript.generated.root,
	);
	const map = serviceScript ? language.maps.get(serviceScript.code, sourceScript!) : undefined;
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
