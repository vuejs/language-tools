import {
	forEachInterpolationNode,
	getScriptLang,
	parseInterpolationNode,
	type ts,
	type TypeScript,
} from '@vue/language-core';
import type { VueVirtualCode } from '@vue/language-service';
import { type AnalysisContext, analyze, type ReactivityAnalysisResult, type SameFileSymbols } from './analyze';
import { vueRules } from './rules';
import { collectAccesses, collectSignals } from './signals';

export type { ReactivityAnalysisResult } from './analyze';

export interface ReactivityAnalysisParams {
	textDocument: { uri: string };
	/** The offset of the cursor in the document. */
	offset: number;
	/** The text of a TypeScript or JavaScript document, which the server does not sync. */
	content?: string;
}

/**
 * The ids of the symbols that the identifiers at `offsets` of the source text of `fileName` refer to, or undefined
 * when the source text that the checker of its project has is not `text`.
 */
export type SymbolIdResolver = (
	fileName: string,
	text: string,
	offsets: readonly number[],
) => Promise<readonly (number | undefined)[] | undefined>;

/** Analyzes one script at a time, keeping what it collected from the last one. */
export function createReactivityAnalyzer(getSymbolIds: SymbolIdResolver) {
	let current: { ts: TypeScript; fileName: string; text: string; context: AnalysisContext } | undefined;

	/** `text` is the source text of `fileName`, `scriptText` the same text with what is not script blanked out. */
	async function analyzeText(
		ts: TypeScript,
		fileName: string,
		text: string,
		scriptFileName: string,
		scriptText: string,
		offset: number,
	) {
		if (current?.ts !== ts || current.fileName !== fileName || current.text !== text) {
			const sourceFile = ts.createSourceFile(scriptFileName, scriptText, ts.ScriptTarget.ESNext);
			const symbols = await resolveSymbols(ts, sourceFile, offsets => getSymbolIds(fileName, text, offsets));
			if (!symbols) {
				return;
			}
			current = {
				ts,
				fileName,
				text,
				context: {
					ts,
					sourceFile,
					signals: collectSignals(ts, sourceFile, vueRules),
					accesses: collectAccesses(ts, sourceFile),
					symbols,
				},
			};
		}
		return analyze(current.context, offset);
	}

	return {
		analyzeScript(ts: TypeScript, fileName: string, text: string, offset: number) {
			return analyzeText(ts, fileName, text, fileName, text, offset);
		},
		/** Analyzes the script blocks of a Vue file in its source offsets, with the rest of the file blanked out. */
		analyzeVueScript(
			virtualCode: VueVirtualCode,
			fileName: string,
			offset: number,
		): Promise<ReactivityAnalysisResult | undefined> {
			const { ir, snapshot } = virtualCode;
			const text = snapshot.getText(0, snapshot.getLength());
			let scriptText = text.replace(/[^\r\n]/g, ' ');
			for (const block of [ir.script, ir.scriptSetup]) {
				if (block) {
					scriptText = scriptText.slice(0, block.offset) + block.content
						+ scriptText.slice(block.offset + block.content.length);
				}
			}
			return analyzeText(virtualCode.ts, fileName, text, `${fileName}.${getScriptLang(ir)}`, scriptText, offset);
		},
	};
}

async function resolveSymbols(
	ts: TypeScript,
	sourceFile: ts.SourceFile,
	getSymbolIds: (offsets: readonly number[]) => ReturnType<SymbolIdResolver>,
): Promise<SameFileSymbols | undefined> {
	const identifiers: ts.Identifier[] = [];
	sourceFile.forEachChild(function visit(node) {
		if (ts.isIdentifier(node)) {
			identifiers.push(node);
		}
		node.forEachChild(visit);
	});
	const ids = await getSymbolIds(identifiers.map(id => id.getStart(sourceFile)));
	if (!ids) {
		return;
	}
	const symbols = new Map<ts.Identifier, { declarations: ts.Identifier[]; references: ts.Identifier[] }>();
	const byId = new Map<number, { declarations: ts.Identifier[]; references: ts.Identifier[] }>();
	identifiers.forEach((id, i) => {
		const symbolId = ids[i];
		if (symbolId === undefined) {
			return;
		}
		let symbol = byId.get(symbolId);
		if (!symbol) {
			byId.set(symbolId, symbol = { declarations: [], references: [] });
		}
		if (isDeclarationName(ts, id)) {
			symbol.declarations.push(id);
		}
		symbol.references.push(id);
		symbols.set(id, symbol);
	});
	return {
		getDeclarations: position => getSymbol(position)?.declarations ?? [],
		getReferences: position => getSymbol(position)?.references ?? [],
	};

	function getSymbol(position: number) {
		const token = ts.getTouchingPropertyName(sourceFile, position);
		return ts.isIdentifier(token) ? symbols.get(token) : undefined;
	}
}

/** Whether `id` names what its parent declares, as a property name of an access or a shorthand value does not. */
function isDeclarationName(ts: TypeScript, id: ts.Identifier) {
	const { parent } = id;
	return (parent as { name?: ts.Node }).name === id
		&& !ts.isPropertyAccessExpression(parent)
		&& !ts.isShorthandPropertyAssignment(parent)
		&& !ts.isExportSpecifier(parent)
		&& !ts.isJsxAttribute(parent);
}

/** The source ranges of the template interpolations and style `v-bind()` expressions of a Vue file. */
export function getInterpolationRanges(virtualCode: VueVirtualCode) {
	const { ir } = virtualCode;
	const ranges: [number, number][] = [];
	if (ir.template?.ast) {
		for (const node of forEachInterpolationNode(ir.template.ast)) {
			const [content, start] = parseInterpolationNode(node, ir.template.content);
			const offset = ir.template.offset + start;
			ranges.push([offset, offset + content.length]);
		}
	}
	for (const style of ir.styles) {
		for (const binding of style.bindings) {
			const offset = style.offset + binding.offset;
			ranges.push([offset, offset + binding.text.length]);
		}
	}
	return ranges;
}
