import type { collectBindingIdentifiers, TypeScript } from '@vue/language-core';
import type * as ts from 'typescript';

/*
 * language-core is typed against the TypeScript 7 AST API, which has no language service, so the language
 * service runs language-core on the classic API instead; it provides everything language-core reads under
 * the same names. These convert between the two at that boundary.
 */
export function asCoreTypeScript(typescript: typeof import('typescript')) {
	return typescript as unknown as TypeScript;
}

export function asClassicNode<T extends ts.Node>(node: CoreNode) {
	return node as unknown as T;
}

export function asCoreNode(node: ts.Node) {
	return node as unknown as CoreNode;
}

type CoreNode = Parameters<typeof collectBindingIdentifiers>[1];
