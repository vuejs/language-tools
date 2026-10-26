import type * as ts from 'typescript/ast' with { 'resolution-mode': 'import' };
import type { TextRange, TypeScript } from '../types';
import { getNodeText } from '../typescript/nodes';
import { collectBindingRanges } from './collectBindings';

export const enum BindingFlag {
	None,
	// Bindings re-asserted per closure by the template codegen (imports, `let`/`var`).
	Variable,
	Const = 1 << 1,
	// `let`/`var` without an initializer; reading these may raise TS2454.
	Uninitialized = 1 << 2,
}

export function parseBindings(
	ts: TypeScript,
	ast: ts.SourceFile,
) {
	const bindings = new Map<string, BindingFlag>();

	ast.forEachChild(node => {
		if (ts.isVariableStatement(node)) {
			const isConst = !!(node.declarationList.flags & ts.NodeFlags.Const);
			for (const decl of node.declarationList.declarations) {
				const flags = isConst
					? BindingFlag.None
					: decl.initializer
					? BindingFlag.Variable
					: BindingFlag.Variable | BindingFlag.Uninitialized;
				for (const { start, end } of collectBindingRanges(ts, decl.name, ast)) {
					bindings.set(ast.text.slice(start, end), flags);
				}
			}
		}
		else if (ts.isFunctionDeclaration(node)) {
			if (node.name && ts.isIdentifier(node.name)) {
				bindings.set(_getNodeText(node.name), BindingFlag.Const);
			}
		}
		else if (ts.isClassDeclaration(node)) {
			if (node.name) {
				bindings.set(_getNodeText(node.name), BindingFlag.Const);
			}
		}
		else if (ts.isEnumDeclaration(node)) {
			bindings.set(_getNodeText(node.name), BindingFlag.Const);
		}

		if (ts.isImportDeclaration(node)) {
			if (node.importClause && node.importClause.phaseModifier !== ts.SyntaxKind.TypeKeyword) {
				const { name, namedBindings } = node.importClause;

				if (name) {
					bindings.set(_getNodeText(name), BindingFlag.Variable);
				}
				if (namedBindings) {
					if (ts.isNamedImports(namedBindings)) {
						for (const element of namedBindings.elements) {
							if (!element.isTypeOnly) {
								bindings.set(_getNodeText(element.name), BindingFlag.Variable);
							}
						}
					}
					else {
						bindings.set(_getNodeText(namedBindings.name), BindingFlag.Variable);
					}
				}
			}
		}
	});

	return bindings;

	function _getNodeText(node: ts.Node) {
		return getNodeText(node, ast);
	}
}

export function getClosestMultiLineCommentRange(
	ts: TypeScript,
	node: ts.Node,
	parents: ts.Node[],
	ast: ts.SourceFile,
): TextRange | undefined {
	for (let i = parents.length - 1; i >= 0; i--) {
		if (ts.isStatement(node)) {
			break;
		}
		node = parents[i]!;
	}
	const comment = ts.getLeadingCommentRanges(ast.text, node.pos)
		?.reverse()
		.find(range => range.kind === 3 satisfies ts.SyntaxKind.MultiLineCommentTrivia);

	if (comment) {
		return {
			node,
			start: comment.pos,
			end: comment.end,
		};
	}
}

export function getUnwrappedExpression(ts: TypeScript, node: ts.Node) {
	while (
		ts.isParenthesizedExpression(node)
		|| ts.isAssertionExpression(node)
		|| ts.isNonNullExpression(node)
		|| ts.isSatisfiesExpression(node)
	) {
		node = node.expression;
	}
	return node;
}
