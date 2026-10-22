import { forEachEmbeddedCode, type Language, type SourceScript, type VueVirtualCode } from '@vue/language-core';
import { createAnalyzer } from 'laplacenoma';
import rulesVue from 'laplacenoma/rules/vue';
import type { URI } from 'vscode-uri';

export interface ReactivityAnalysisParams {
	textDocument: { uri: string };
	/** The offset of the cursor in the document. */
	offset: number;
	/** The text of a TypeScript or JavaScript document, which the server does not sync. */
	content?: string;
}

export interface ReactivityAnalysisResult {
	dependencyRanges: Range[];
	dependentRanges: Range[];
}

interface Range {
	pos: number;
	end: number;
}

/** Analyzes one script at a time with a single-file TypeScript language service, the way the analyzer's rules expect. */
export function createReactivityAnalyzer(ts: typeof import('typescript')) {
	const analyzer = createAnalyzer({ rules: rulesVue });
	let currentFileName = '';
	let currentText = '';
	let version = 0;
	const languageService = ts.createLanguageService({
		getProjectVersion: () => version.toString(),
		getScriptVersion: () => version.toString(),
		getScriptFileNames: () => [currentFileName],
		getScriptSnapshot: fileName => fileName === currentFileName ? ts.ScriptSnapshot.fromString(currentText) : undefined,
		getCompilationSettings: () => ({ allowJs: true, allowNonTsExtensions: true }),
		getCurrentDirectory: () => '',
		getDefaultLibFileName: () => '',
		readFile: () => undefined,
		fileExists: fileName => fileName === currentFileName,
	});

	function analyze(fileName: string, text: string, offset: number, isMapped?: (range: Range) => boolean) {
		if (fileName !== currentFileName || text !== currentText) {
			currentFileName = fileName;
			currentText = text;
			version++;
		}
		const sourceFile = languageService.getProgram()!.getSourceFile(fileName)!;
		return analyzer.analyze(sourceFile, offset, {
			typescript: ts,
			languageService,
			toSourceRange: (pos, end) => !isMapped || isMapped({ pos, end }) ? { pos, end } : undefined,
		});
	}

	return {
		analyzeScript(fileName: string, text: string, offset: number): ReactivityAnalysisResult | undefined {
			return analyze(fileName, text, offset);
		},
		/** Analyzes the service script of a Vue file, in source offsets; code without a source counterpart is skipped. */
		analyzeVueScript(
			language: Language<URI>,
			sourceScript: SourceScript<URI>,
			virtualCode: VueVirtualCode,
			fileName: string,
			offset: number,
		): ReactivityAnalysisResult | undefined {
			const serviceScript = sourceScript.generated!.languagePlugin.typescript?.getServiceScript(virtualCode);
			if (!serviceScript) {
				return;
			}
			const map = language.maps.get(serviceScript.code, sourceScript);
			const toSourceRange = ({ pos, end }: Range): Range | undefined => {
				for (const [start, mappedEnd] of map.toSourceRange(pos, end, false)) {
					return { pos: start, end: mappedEnd };
				}
			};
			const [generated] = map.toGeneratedLocation(offset);
			if (!generated) {
				return;
			}
			const result = analyze(
				fileName + serviceScript.extension,
				serviceScript.code.snapshot.getText(0, serviceScript.code.snapshot.getLength()),
				generated[0],
				range => !!toSourceRange(range),
			);
			return result && {
				dependencyRanges: result.dependencyRanges.map(range => toSourceRange(range)!),
				dependentRanges: result.dependentRanges.map(range => toSourceRange(range)!),
			};
		},
	};
}

/** The source ranges of the template interpolations and style `v-bind()` expressions of a Vue file. */
export function getInterpolationRanges(virtualCode: VueVirtualCode) {
	const ranges: [number, number][] = [];
	for (const code of forEachEmbeddedCode(virtualCode)) {
		const codeText = code.snapshot.getText(0, code.snapshot.getLength());
		if (
			(
				code.id.startsWith('template_inline_ts_')
				&& codeText.startsWith('0 +')
				&& codeText.endsWith('+ 0;')
			)
			|| (code.id.startsWith('style_') && code.id.endsWith('_inline_ts'))
		) {
			for (const mapping of code.mappings) {
				for (let i = 0; i < mapping.sourceOffsets.length; i++) {
					ranges.push([
						mapping.sourceOffsets[i]!,
						mapping.sourceOffsets[i]! + mapping.lengths[i]!,
					]);
				}
			}
		}
	}
	return ranges;
}
