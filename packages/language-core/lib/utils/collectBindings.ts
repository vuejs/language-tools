import type * as ts from 'typescript';
import { getNodeText, getStartEnd } from './shared';

export function collectBindingNames(
	ts: typeof import('typescript'),
	node: ts.Node,
	ast: ts.SourceFile,
) {
	return collectBindingIdentifiers(ts, node).map(({ id }) => getNodeText(ts, id, ast));
}

export function collectBindingRanges(
	ts: typeof import('typescript'),
	node: ts.Node,
	ast: ts.SourceFile,
) {
	return collectBindingIdentifiers(ts, node).map(({ id }) => getStartEnd(ts, id, ast));
}

export function collectBindingIdentifiers(
	ts: typeof import('typescript'),
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
			if (ts.isBindingElement(el)) {
				collectBindingIdentifiers(ts, el.name, results, !!el.dotDotDotToken, el.initializer);
			}
		}
	}
	else {
		ts.forEachChild(node, node => collectBindingIdentifiers(ts, node, results, false));
	}
	return results;
}
