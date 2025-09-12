import type * as ts from 'typescript';
import type { TextRange } from '../types';
import { collectBindingRanges } from '../utils/collectBindings';
import { getNodeText, getStartEnd } from '../utils/shared';

export function parseBindingRanges(ts: typeof import('typescript'), ast: ts.SourceFile) {
	const bindings: {
		range: TextRange;
		moduleName?: string;
		isDefaultImport?: boolean;
		isNamespace?: boolean;
	}[] = [];

	ts.forEachChild(ast, node => {
		if (ts.isVariableStatement(node)) {
			for (const decl of node.declarationList.declarations) {
				const ranges = collectBindingRanges(ts, decl.name, ast);
				bindings.push(...ranges.map(range => ({ range })));
			}
		}
		else if (ts.isFunctionDeclaration(node)) {
			if (node.name && ts.isIdentifier(node.name)) {
				bindings.push({
					range: _getStartEnd(node.name),
				});
			}
		}
		else if (ts.isClassDeclaration(node)) {
			if (node.name) {
				bindings.push({
					range: _getStartEnd(node.name),
				});
			}
		}
		else if (ts.isEnumDeclaration(node)) {
			bindings.push({
				range: _getStartEnd(node.name),
			});
		}

		if (ts.isImportDeclaration(node)) {
			const moduleName = _getNodeText(node.moduleSpecifier).slice(1, -1);

			if (node.importClause && !node.importClause.isTypeOnly) {
				const { name, namedBindings } = node.importClause;

				if (name) {
					bindings.push({
						range: _getStartEnd(name),
						moduleName,
						isDefaultImport: true,
					});
				}
				if (namedBindings) {
					if (ts.isNamedImports(namedBindings)) {
						for (const element of namedBindings.elements) {
							if (element.isTypeOnly) {
								continue;
							}
							bindings.push({
								range: _getStartEnd(element.name),
								moduleName,
								isDefaultImport: element.propertyName?.text === 'default',
							});
						}
					}
					else {
						bindings.push({
							range: _getStartEnd(namedBindings.name),
							moduleName,
							isNamespace: true,
						});
					}
				}
			}
		}
	});

	return bindings;

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
) {
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
			start: comment.pos,
			end: comment.end,
		};
	}
}
