import { forEachInterpolationNode, getScriptLang, parseInterpolationNode, type TypeScript } from '@vue/language-core';
import type { VueVirtualCode } from '@vue/language-service';
import { type AnalysisContext, analyze, type ReactivityAnalysisResult } from './analyze';
import { vueRules } from './rules';
import { collectAccesses, collectSignals } from './signals';
import { resolveSameFileSymbols } from './symbols';

export type { ReactivityAnalysisResult } from './analyze';

export interface ReactivityAnalysisParams {
	textDocument: { uri: string };
	/** The offset of the cursor in the document. */
	offset: number;
	/** The text of a TypeScript or JavaScript document, which the server does not sync. */
	content?: string;
}

/** Analyzes one script at a time, keeping what it collected from the last one. */
export function createReactivityAnalyzer() {
	let current: { ts: TypeScript; fileName: string; text: string; context: AnalysisContext } | undefined;

	function analyzeText(ts: TypeScript, fileName: string, text: string, offset: number) {
		if (current?.ts !== ts || current.fileName !== fileName || current.text !== text) {
			const sourceFile = ts.createSourceFile(fileName, text, ts.ScriptTarget.ESNext);
			current = {
				ts,
				fileName,
				text,
				context: {
					ts,
					sourceFile,
					signals: collectSignals(ts, sourceFile, vueRules),
					accesses: collectAccesses(ts, sourceFile),
					symbols: resolveSameFileSymbols(ts, sourceFile),
				},
			};
		}
		return analyze(current.context, offset);
	}

	return {
		analyzeScript(ts: TypeScript, fileName: string, text: string, offset: number) {
			return analyzeText(ts, fileName, text, offset);
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
			return analyzeText(virtualCode.ts, `${fileName}.${getScriptLang(ir)}`, text, offset);
		},
	};
}

/** The source ranges of the template interpolations and style `v-bind()` expressions of a Vue file. */
export function getInterpolationRanges(virtualCode: VueVirtualCode) {
	const { ir } = virtualCode;
	const ranges: [number, number][] = [];
	if (ir.template?.ast) {
		for (const node of forEachInterpolationNode(ir.template.ast)) {
			const [content, start] = parseInterpolationNode(node, ir.template.content);
			const offset = ir.template.startTagEnd + start;
			ranges.push([offset, offset + content.length]);
		}
	}
	for (const style of ir.styles) {
		for (const binding of style.bindings) {
			const offset = style.startTagEnd + binding.offset;
			ranges.push([offset, offset + binding.text.length]);
		}
	}
	return ranges;
}
