import * as CompilerDOM from '@vue/compiler-dom';
import type * as ts from 'typescript/ast' with { 'resolution-mode': 'import' };
import type { IR, TypeScript } from '../types';
import { collectBindingNames } from './collectBindings';
import { parseVForNode } from './templateExpressions';

/**
 * Collects the names used in template expressions that are listed by TypeScript's template scope.
 * This includes both setup bindings used in the template and local variables (from v-for, v-slot).
 * This is derived from the template AST without running the TypeScript code generation.
 */
export function collectTemplateScopeNames(
	typescript: TypeScript,
	ir: IR,
	setupBindings: Set<string>,
	setupConsts: Set<string>,
): { scopeBindings: Set<string>; allScopeNames: Set<string> } {
	const allScopeNames = new Set<string>();
	const scopeBindings = new Set<string>();
	const template = ir.template;

	if (!template?.ast) {
		return { scopeBindings, allScopeNames };
	}

	walkNode(template.ast, []);

	return { scopeBindings, allScopeNames };

	function walkNode(
		node: CompilerDOM.RootNode | CompilerDOM.TemplateChildNode,
		localScopes: Set<string>[],
	) {
		if (node.type === CompilerDOM.NodeTypes.COMMENT) {
			return;
		}

		switch (node.type) {
			case CompilerDOM.NodeTypes.INTERPOLATION: {
				if (node.content.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
					collectNamesFromExpression(node.content.content, localScopes);
				}
				break;
			}
			case CompilerDOM.NodeTypes.IF: {
				for (const branch of node.branches) {
					walkNode(branch, localScopes);
				}
				break;
			}
			case CompilerDOM.NodeTypes.IF_BRANCH: {
				if (node.condition?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
					collectNamesFromExpression(node.condition.content, localScopes);
				}
				for (const child of node.children) {
					walkNode(child, localScopes);
				}
				break;
			}
			case CompilerDOM.NodeTypes.FOR: {
				const newLocals = new Set<string>();
				const { leftExpressionText } = parseVForNode(node);
				if (leftExpressionText) {
					for (const name of getBindingNames(typescript, `const [${leftExpressionText}]`)) {
						newLocals.add(name);
					}
				}

				if (node.parseResult.source.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
					collectNamesFromExpression(node.parseResult.source.content, localScopes);
				}

				for (const child of node.children) {
					walkNode(child, [...localScopes, newLocals]);
				}
				break;
			}
			case CompilerDOM.NodeTypes.ELEMENT: {
				const newLocals = new Set<string>();

				for (const prop of node.props) {
					if (prop.type !== CompilerDOM.NodeTypes.DIRECTIVE) {
						continue;
					}

					// v-slot creates local bindings
					if (prop.name === 'slot' && prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
						for (const name of getBindingNames(typescript, `(${prop.exp.content}) => {}`)) {
							newLocals.add(name);
						}
					}

					// dynamic directive arg
					if (
						prop.arg
						&& prop.arg.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
						&& !prop.arg.isStatic
					) {
						collectNamesFromExpression(prop.arg.content, localScopes);
					}

					// directive expression (skip v-slot and v-for values)
					if (
						prop.exp
						&& prop.exp.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
						&& prop.name !== 'slot'
						&& prop.name !== 'for'
					) {
						collectNamesFromExpression(prop.exp.content, localScopes);
					}
				}

				for (const child of node.children) {
					walkNode(child, newLocals.size > 0 ? [...localScopes, newLocals] : localScopes);
				}
				break;
			}
			case CompilerDOM.NodeTypes.ROOT: {
				for (const child of node.children) {
					walkNode(child, localScopes);
				}
				break;
			}
		}
	}

	function collectNamesFromExpression(content: string, localScopes: Set<string>[]) {
		// Parse the expression to extract identifiers
		const ast = typescript.createSourceFile('/template-expression.ts', content, typescript.ScriptTarget.Latest);
		const identifiers = new Set<string>();

		function walk(node: ts.Node) {
			if (typescript.isIdentifier(node)) {
				const name = node.text;
				// Skip known globals and internals
				if (
					name !== 'undefined'
					&& name !== 'null'
					&& name !== 'true'
					&& name !== 'false'
					&& name !== 'this'
					&& name !== 'arguments'
					&& !name.startsWith('__VLS_')
				) {
					identifiers.add(name);
				}
			}
			node.forEachChild(walk);
		}

		walk(ast);

		// Check each identifier
		for (const name of identifiers) {
			// Check if it's a local variable in any scope
			let isLocal = false;
			for (const scope of localScopes) {
				if (scope.has(name)) {
					isLocal = true;
					break;
				}
			}

			if (isLocal) {
				// Local variable used in expression - add to allScopeNames
				allScopeNames.add(name);
			}
			else if (setupBindings.has(name) || setupConsts.has(name)) {
				// Setup binding or const used in expression
				scopeBindings.add(name);
				allScopeNames.add(name);
			}
		}
	}

	function getBindingNames(typescript: TypeScript, text: string) {
		const ast = typescript.createSourceFile('/a.ts', text, typescript.ScriptTarget.Latest);
		return collectBindingNames(typescript, ast, ast);
	}
}
