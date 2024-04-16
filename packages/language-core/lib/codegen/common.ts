import { getNodeText } from '../parsers/scriptSetupRanges';
import type { Code, VueCodeInformation } from '../types';
import type * as ts from 'typescript';

export const newLine = '\n';
export const endOfLine = `;${newLine}`;
export const combineLastMapping: VueCodeInformation = { __combineLastMapping: true };
export const variableNameRegex = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/;

export function* wrapWith(startOffset: number, endOffset: number, features: VueCodeInformation, ...wrapCodes: Code[]): Generator<Code> {
	yield ['', 'template', startOffset, features];
	let offset = 0;
	for (const wrapCode of wrapCodes) {
		offset++;
		yield wrapCode;
	}
	yield ['', 'template', endOffset, { __combineOffsetMapping: offset }];
}

export function collectVars(
	ts: typeof import('typescript'),
	node: ts.Node,
	ast: ts.SourceFile,
	result: string[],
) {
	if (ts.isIdentifier(node)) {
		result.push(getNodeText(ts, node, ast));
	}
	else if (ts.isObjectBindingPattern(node)) {
		for (const el of node.elements) {
			collectVars(ts, el.name, ast, result);
		}
	}
	else if (ts.isArrayBindingPattern(node)) {
		for (const el of node.elements) {
			if (ts.isBindingElement(el)) {
				collectVars(ts, el.name, ast, result);
			}
		}
	}
	else {
		ts.forEachChild(node, node => collectVars(ts, node, ast, result));
	}
}
export function createTsAst(ts: typeof import('typescript'), astHolder: any, text: string) {
	if (astHolder.__volar_ast_text !== text) {
		astHolder.__volar_ast_text = text;
		astHolder.__volar_ast = ts.createSourceFile('/a.ts', text, 99 satisfies ts.ScriptTarget.ESNext);
	}
	return astHolder.__volar_ast as ts.SourceFile;
}
