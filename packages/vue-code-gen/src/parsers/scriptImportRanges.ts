import type * as ts from 'typescript/lib/tsserverlibrary';
import { getStartEnd } from './scriptSetupRanges';
import type { TextRange } from '../types';

export interface ScriptImportRanges extends ReturnType<typeof parseScriptImportRanges> { }

export function parseScriptImportRanges(ts: typeof import('typescript/lib/tsserverlibrary'), ast: ts.SourceFile, end: number) {

	const calls: {
		code: TextRange,
		// import BaseText from './vue.js'
		//                      ^^^^^^^^^^
		moduleSpecifier: TextRange
	}[] = [];

	ast.forEachChild(node => {
		visitNode(node);
	});

	return calls;

	function visitNode(node: ts.Node) {
		if (ts.isImportDeclaration(node)) {
			const code = getStartEnd(node, ast)
			if (code.start <= end) {
				calls.push({
					code: code,
					moduleSpecifier: getStartEnd(node.moduleSpecifier, ast)
				})
				node.moduleSpecifier
			}
		}
		node.forEachChild(child => visitNode(child));
	}
}
