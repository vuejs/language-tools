import type * as ts from 'typescript';
import type { TextRange } from '../types';
import { collectBindingNames } from '../utils/collectBindings';
import { getNodeText } from '../utils/shared';

export type BindingType = 'let' | 'const';

export function parseBindings(
	ts: typeof import('typescript'),
	ast: ts.SourceFile,
	componentExtsensions: string[],
) {
	const bindings = new Map<string, BindingType>();
	const components: string[] = [];

	ts.forEachChild(ast, node => {
		if (ts.isVariableStatement(node)) {
			for (const decl of node.declarationList.declarations) {
				for (const name of collectBindingNames(ts, decl.name, ast)) {
					bindings.set(
						name,
						node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ConstKeyword) ? 'const' : 'let',
					);
				}
			}
		}
		else if (ts.isFunctionDeclaration(node)) {
			if (node.name && ts.isIdentifier(node.name)) {
				bindings.set(_getNodeText(node.name), 'const');
			}
		}
		else if (ts.isClassDeclaration(node)) {
			if (node.name) {
				bindings.set(_getNodeText(node.name), 'const');
			}
		}
		else if (ts.isEnumDeclaration(node)) {
			bindings.set(_getNodeText(node.name), 'const');
		}

		if (ts.isImportDeclaration(node)) {
			const moduleName = _getNodeText(node.moduleSpecifier).slice(1, -1);

			if (node.importClause && !node.importClause.isTypeOnly) {
				const { name, namedBindings } = node.importClause;

				if (name) {
					if (componentExtsensions.some(ext => moduleName.endsWith(ext))) {
						components.push(_getNodeText(name));
					}
					else {
						bindings.set(_getNodeText(name), 'const');
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
								components.push(_getNodeText(element.name));
							}
							else {
								bindings.set(_getNodeText(element.name), 'const');
							}
						}
					}
					else {
						bindings.set(_getNodeText(namedBindings.name), 'const');
					}
				}
			}
		}
	});

	return {
		bindings,
		components,
	};

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
