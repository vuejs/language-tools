import type * as ts from 'typescript';
import { collectIdentifiers } from '../codegen/common';

/**
 * true -> prop binding
 * false -> local binding
 */
type Scope = Record<string, boolean>;

/**
 * Refactored from https://github.com/vuejs/core/blob/main/packages/compiler-sfc/src/script/definePropsDestructure.ts
 */
export function findDestructuredProps(
	ts: typeof import('typescript'),
	ast: ts.SourceFile,
	props: string[]
) {
	const rootScope: Scope = {};
	const scopeStack: Scope[] = [rootScope];
	let currentScope: Scope = rootScope;
	const excludedIds = new WeakSet<ts.Identifier>();
	const parentStack: ts.Node[] = [];

	for (const prop of props) {
		rootScope[prop] = true;
	}

	function pushScope() {
		scopeStack.push((currentScope = Object.create(currentScope)));
	}

	function popScope() {
		scopeStack.pop()
		currentScope = scopeStack[scopeStack.length - 1] || null;
	}

	function registerLocalBinding(id: ts.Identifier) {
		excludedIds.add(id)
		if (currentScope) {
		  	currentScope[id.text] = false;
		}
	}

	const references: [ts.Identifier, boolean][] = [];

	walkScope(ast, true);
	walk(ast);

	return references;

	function walkScope(node: ts.Node, isRoot = false) {
		ts.forEachChild(node, (stmt) => {
			if (ts.isVariableStatement(stmt)) {
				for (const decl of stmt.declarationList.declarations) {
					walkVariableDeclaration(decl, isRoot);
				}
			}
			else if (
				ts.isFunctionDeclaration(stmt) ||
				ts.isClassDeclaration(stmt)
			) {
				const declare = ts.getModifiers(stmt)?.find((modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword);
				if (!stmt.name || declare) return;
				registerLocalBinding(stmt.name);
			}
			else if (
				(ts.isForOfStatement(stmt) || ts.isForInStatement(stmt)) &&
				ts.isVariableDeclarationList(stmt.initializer)
			) {
				walkVariableDeclaration(stmt.initializer.declarations[0], isRoot);
			}
			else if (
				ts.isLabeledStatement(stmt) &&
				ts.isVariableDeclaration(stmt.statement)
			) {
				walkVariableDeclaration(stmt.statement, isRoot);
			}
		});
	}

	function walkVariableDeclaration(decl: ts.VariableDeclaration, isRoot = false) {
		const { initializer, name } = decl;
		const isDefineProps =
			isRoot
			&& initializer
			&& ts.isCallExpression(initializer)
			&& initializer.expression.getText(ast) === 'defineProps';

		for (const id of collectIdentifiers(ts, name)) {
			if (isDefineProps) {
				excludedIds.add(id)
			} else {
				registerLocalBinding(id)
			}
		}
	}

	function walkFunctionDeclaration(node: ts.SignatureDeclaration) {
		const { name, parameters } = node;
		if (name && ts.isIdentifier(name)) {
			registerLocalBinding(name);
		}

		for (const p of parameters) {
			for (const id of collectIdentifiers(ts, p)) {
				registerLocalBinding(id);
			}
		}
	}

	async function walk(parent: ts.Node) {
		ts.forEachChild(parent, (node) => {
			if (enter(node) ?? true) {
				walk(node);
				leave(node);
			}
		});

		function enter(node: ts.Node) {
			parent && parentStack.push(parent);

			if (
				ts.isTypeLiteralNode(node) ||
				ts.isTypeReferenceNode(node)
			) {
				return false;
			}

			if (ts.isFunctionLike(node)) {
				pushScope();
				walkFunctionDeclaration(node);
				if ('body' in node) {
					walkScope(node.body!);
				}
				return;
			}

			if (ts.isCatchClause(node)) {
				pushScope();
				const { variableDeclaration: p } = node;
				if (p && ts.isIdentifier(p.name)) {
					registerLocalBinding(p.name);
				}
				walkScope(node.block);
				return;
			}

			if (
				ts.isBlock(node)
				&& !ts.isFunctionLike(parent)
				&& !ts.isCatchClause(parent)
			) {
				pushScope();
				walkScope(node);
				return;
			}

			if (
				ts.isIdentifier(node)
				&& isReferencedIdentifier(node, parent)
				&& !excludedIds.has(node)
			) {
				const name = node.text;
				if (currentScope[name]) {
					const isShorthand = ts.isShorthandPropertyAssignment(parent);
					references.push([node, isShorthand]);
				}
			}
		}

		function leave(node: ts.Node) {
			parent && parentStack.pop();
			if (
				ts.isFunctionLike(node)
				|| ts.isCatchClause(node)
				|| (
					ts.isBlock(node)
					&& !ts.isFunctionLike(parent)
					&& !ts.isCatchClause(parent)
				)
			) {
				popScope();
			}
		}
	}

	// TODO: more conditions
	function isReferencedIdentifier(
		id: ts.Identifier,
		parent: ts.Node | null
	) {
		if (!parent) {
			return false;
		}

		if (id.text === 'arguments') {
			return false;
		}

		if (
			ts.isExpressionWithTypeArguments(parent) ||
			ts.isInterfaceDeclaration(parent) ||
			ts.isTypeAliasDeclaration(parent) ||
			ts.isPropertySignature(parent)
		) {
			return false;
		}

		if (
			ts.isPropertyAccessExpression(parent) ||
			ts.isPropertyAssignment(parent) ||
			ts.isPropertyDeclaration(parent)
		) {
			if (parent.name === id) {
				return false;
			}
		}

		return true;
	}
}