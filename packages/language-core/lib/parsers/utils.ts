import type * as ts from 'typescript';
import type { TextRange } from '../types';
import { collectBindingRanges } from '../utils/collectBindings';
import { getNodeText } from '../utils/shared';

export const enum BindingFlag {
	None,
	// Bindings re-asserted per closure by the template codegen (imports, `let`/`var`).
	Variable,
	Const = 1 << 1,
	Component = 1 << 2,
}

export function parseBindings(
	ts: typeof import('typescript'),
	ast: ts.SourceFile,
	componentExtsensions: string[],
) {
	const bindings = new Map<string, BindingFlag>();

	ts.forEachChild(ast, node => {
		if (ts.isVariableStatement(node)) {
			const flags = (node.declarationList.flags & ts.NodeFlags.Const)
				? BindingFlag.None
				: BindingFlag.Variable;
			for (const decl of node.declarationList.declarations) {
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
			const moduleName = _getNodeText(node.moduleSpecifier).slice(1, -1);

			if (node.importClause && !node.importClause.isTypeOnly) {
				const { name, namedBindings } = node.importClause;

				if (name) {
					if (componentExtsensions.some(ext => moduleName.endsWith(ext))) {
						bindings.set(_getNodeText(name), BindingFlag.Const | BindingFlag.Component);
					}
					else {
						bindings.set(_getNodeText(name), BindingFlag.Variable);
					}
				}
				if (namedBindings) {
					if (ts.isNamedImports(namedBindings)) {
						for (const element of namedBindings.elements) {
							if (element.isTypeOnly) {
								continue;
							}
							if (
								element.propertyName
								&& _getNodeText(element.propertyName) === 'default'
								&& componentExtsensions.some(ext => moduleName.endsWith(ext))
							) {
								bindings.set(_getNodeText(element.name), BindingFlag.Const | BindingFlag.Component);
							}
							else {
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
		return getNodeText(ts, node, ast);
	}
}

export function getClosestMultiLineCommentRange(
	ts: typeof import('typescript'),
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

export function getUnwrappedExpression(ts: typeof import('typescript'), node: ts.Node) {
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
