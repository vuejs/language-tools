import * as CompilerDOM from '@vue/compiler-dom';
import type * as ts from 'typescript';
import { getNodeText } from '../../parsers/scriptSetupRanges';
import type { Code, SfcBlock, SfcBlockAttr, VueCodeInformation } from '../../types';

export const newLine = `\n`;
export const endOfLine = `;${newLine}`;
export const combineLastMapping: VueCodeInformation = { __combineOffset: 1 };
export const variableNameRegex = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/;

export function* wrapWith(
	startOffset: number,
	endOffset: number,
	features: VueCodeInformation,
	...wrapCodes: Code[]
): Generator<Code> {
	yield ['', 'template', startOffset, features];
	let offset = 1;
	for (const wrapCode of wrapCodes) {
		if (typeof wrapCode !== 'string') {
			offset++;
		}
		yield wrapCode;
	}
	yield ['', 'template', endOffset, { __combineOffset: offset }];
}

export function collectVars(
	ts: typeof import('typescript'),
	node: ts.Node,
	ast: ts.SourceFile,
	results: string[] = []
) {
	const identifiers = collectIdentifiers(ts, node, []);
	for (const { id } of identifiers) {
		results.push(getNodeText(ts, id, ast));
	}
	return results;
}

export function collectIdentifiers(
	ts: typeof import('typescript'),
	node: ts.Node,
	results: {
		id: ts.Identifier,
		isRest: boolean,
		initializer: ts.Expression | undefined;
	}[] = [],
	isRest = false,
	initializer: ts.Expression | undefined = undefined
) {
	if (ts.isIdentifier(node)) {
		results.push({ id: node, isRest, initializer });
	}
	else if (ts.isObjectBindingPattern(node)) {
		for (const el of node.elements) {
			collectIdentifiers(ts, el.name, results, !!el.dotDotDotToken, el.initializer);
		}
	}
	else if (ts.isArrayBindingPattern(node)) {
		for (const el of node.elements) {
			if (ts.isBindingElement(el)) {
				collectIdentifiers(ts, el.name, results, !!el.dotDotDotToken);
			}
		}
	}
	else {
		ts.forEachChild(node, node => collectIdentifiers(ts, node, results, false));
	}
	return results;
}

export function normalizeAttributeValue(node: CompilerDOM.TextNode): [string, number] {
	let offset = node.loc.start.offset;
	let content = node.loc.source;
	if (
		(content.startsWith(`'`) && content.endsWith(`'`))
		|| (content.startsWith(`"`) && content.endsWith(`"`))
	) {
		offset++;
		content = content.slice(1, -1);
	}
	return [content, offset];
}

export function createTsAst(ts: typeof import('typescript'), astHolder: any, text: string) {
	if (astHolder.__volar_ast_text !== text) {
		astHolder.__volar_ast_text = text;
		astHolder.__volar_ast = ts.createSourceFile('/a.ts', text, 99 satisfies ts.ScriptTarget.ESNext);
	}
	return astHolder.__volar_ast as ts.SourceFile;
}

export function generateSfcBlockSection(block: SfcBlock, start: number, end: number, features: VueCodeInformation): Code {
	return [
		block.content.slice(start, end),
		block.name,
		start,
		features,
	];
}

export function* generateSfcBlockAttrValue(
	src: SfcBlockAttr & object,
	text: string,
	features: VueCodeInformation
): Generator<Code> {
	const { offset, quotes } = src;
	if (!quotes) {
		yield [``, 'main', offset, { verification: true }];
	}
	yield [
		`'${text}'`,
		'main',
		quotes ? offset - 1 : offset,
		features
	];
	if (!quotes) {
		yield [``, 'main', offset + text.length, { __combineOffset: 2 }];
	}
}
