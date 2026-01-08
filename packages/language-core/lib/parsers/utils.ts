import type * as ts from 'typescript';
import type { TextRange } from '../types';
import { collectBindingRanges } from '../utils/collectBindings';
import { getNodeText, getStartEnd } from '../utils/shared';

export function parseBindingRanges(
	ts: typeof import('typescript'),
	ast: ts.SourceFile,
	componentExtsensions: string[],
) {
	const bindings: TextRange[] = [];
	const components: TextRange[] = [];

	ts.forEachChild(ast, node => {
		if (ts.isVariableStatement(node)) {
			for (const decl of node.declarationList.declarations) {
				const ranges = collectBindingRanges(ts, decl.name, ast);
				bindings.push(...ranges);
			}
		}
		else if (ts.isFunctionDeclaration(node)) {
			if (node.name && ts.isIdentifier(node.name)) {
				bindings.push(_getStartEnd(node.name));
			}
		}
		else if (ts.isClassDeclaration(node)) {
			if (node.name) {
				bindings.push(_getStartEnd(node.name));
			}
		}
		else if (ts.isEnumDeclaration(node)) {
			bindings.push(_getStartEnd(node.name));
		}

		if (ts.isImportDeclaration(node)) {
			const moduleName = _getNodeText(node.moduleSpecifier).slice(1, -1);

			if (node.importClause && !node.importClause.isTypeOnly) {
				const { name, namedBindings } = node.importClause;

				if (name) {
					if (componentExtsensions.some(ext => moduleName.endsWith(ext))) {
						components.push(_getStartEnd(name));
					}
					else {
						bindings.push(_getStartEnd(name));
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
								components.push(_getStartEnd(element.name));
							}
							else {
								bindings.push(_getStartEnd(element.name));
							}
						}
					}
					else {
						bindings.push(_getStartEnd(namedBindings.name));
					}
				}
			}
		}
	});

	return {
		bindings,
		components,
	};

	function _getStartEnd(node: ts.Node) {
		return getStartEnd(ts, node, ast);
	}

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
