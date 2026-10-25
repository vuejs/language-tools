import { forEachEmbeddedCode, getScriptLang, type VueVirtualCode } from '@vue/language-core';
import { createAnalyzer } from 'laplacenoma';
import rulesVue from 'laplacenoma/rules/vue';

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

	function analyze(fileName: string, text: string, offset: number) {
		if (fileName !== currentFileName || text !== currentText) {
			currentFileName = fileName;
			currentText = text;
			version++;
		}
		const sourceFile = languageService.getProgram()!.getSourceFile(fileName)!;
		return analyzer.analyze(sourceFile, offset, {
			typescript: ts,
			languageService,
			toSourceRange: (pos, end) => ({ pos, end }),
		});
	}

	return {
		analyzeScript(fileName: string, text: string, offset: number): ReactivityAnalysisResult | undefined {
			return analyze(fileName, text, offset);
		},
		/** Analyzes the script blocks of a Vue file in its source offsets, with the rest of the file blanked out. */
		analyzeVueScript(
			virtualCode: VueVirtualCode,
			fileName: string,
			offset: number,
		): ReactivityAnalysisResult | undefined {
			const { ir, snapshot } = virtualCode;
			let text = snapshot.getText(0, snapshot.getLength()).replace(/[^\r\n]/g, ' ');
			for (const block of [ir.script, ir.scriptSetup]) {
				if (block) {
					text = text.slice(0, block.startTagEnd) + block.content
						+ text.slice(block.startTagEnd + block.content.length);
				}
			}
			return analyze(`${fileName}.${getScriptLang(ir)}`, text, offset);
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
			for (const [, , start, length] of code.mappings) {
				ranges.push([start, start + length]);
			}
		}
	}
	return ranges;
}
