import type * as CompilerDOM from '@vue/compiler-dom';
import type * as ts from 'typescript';
import type { Code, SfcBlock, VueCodeInformation } from '../../types';
import { getNodeText } from '../../utils/shared';

export const newLine = `\n`;
export const endOfLine = `;${newLine}`;
export const combineLastMapping: VueCodeInformation = { __combineOffset: 1 };
export const identifierRegex = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/;

export function collectVars(
	ts: typeof import('typescript'),
	node: ts.Node,
	ast: ts.SourceFile,
	results: string[] = [],
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
	initializer: ts.Expression | undefined = undefined,
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

export function createTsAst(
	ts: typeof import('typescript'),
	templateAst: CompilerDOM.RootNode | undefined,
	text: string,
) {
	const inlineTsAsts = (templateAst as any)?.__volar_inlineTsAsts;
	let ast = inlineTsAsts?.get(text);
	if (!ast) {
		ast = ts.createSourceFile('/a.ts', text, 99 satisfies ts.ScriptTarget.ESNext);
		inlineTsAsts?.set(text, ast);
	}
	ast.__volar_used = true;
	return ast as ts.SourceFile;
}

export function generateSfcBlockSection(block: SfcBlock, start: number, end: number, features: VueCodeInformation): Code {
	return [
		block.content.slice(start, end),
		block.name,
		start,
		features,
	];
}
