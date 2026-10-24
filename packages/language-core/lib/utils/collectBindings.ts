import type * as ts from 'typescript/ast' with { 'resolution-mode': 'import' };
import type { TypeScript } from '../types';
import { getNodeText, getStartEnd } from './shared';

export function collectBindingNames(
	ts: TypeScript,
	node: ts.Node,
	ast: ts.SourceFile,
) {
	return collectBindingIdentifiers(ts, node).map(({ id }) => getNodeText(id, ast));
}

export function collectBindingRanges(
	ts: TypeScript,
	node: ts.Node,
	ast: ts.SourceFile,
) {
	return collectBindingIdentifiers(ts, node).map(({ id }) => getStartEnd(id, ast));
}

export function collectBindingIdentifiers(
	ts: TypeScript,
	node: ts.Node,
	results: {
		id: ts.Identifier;
		isRest: boolean;
		initializer: ts.Expression | undefined;
	}[] = [],
	isRest = false,
	initializer: ts.Expression | undefined = undefined,
) {
	if (ts.isIdentifier(node)) {
		results.push({ id: node, isRest, initializer });
	}
	else if (ts.isArrayBindingPattern(node) || ts.isObjectBindingPattern(node)) {
		for (const el of node.elements) {
			if (ts.isBindingElement(el) && el.name) {
				collectBindingIdentifiers(ts, el.name, results, !!el.dotDotDotToken, el.initializer);
			}
		}
	}
	else {
		node.forEachChild(node => collectBindingIdentifiers(ts, node, results, false));
	}
	return results;
}
