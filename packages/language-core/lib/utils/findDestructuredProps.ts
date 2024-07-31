import type * as ts from 'typescript';

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
	props: ts.Identifier[]
) {
	const rootScope: Scope = {};
	const scopeStack: Scope[] = [rootScope];
	let currentScope: Scope = rootScope;
	const excludedIds = new WeakSet<ts.Identifier>();
	const parentStack: ts.Node[] = [];

	for (const prop of props) {
		rootScope[prop.text] = true;
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

	const references: ts.Identifier[] = [];

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

		for (const id of extractIdentifiers(ts, name)) {
			if (isDefineProps) {
				excludedIds.add(id)
			} else {
				registerLocalBinding(id)
			}
		}
	}

	function walkFunctionParams(node: ts.SignatureDeclaration) {
		for (const p of node.parameters) {
			for (const id of extractIdentifiers(ts, p)) {
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

			if (isFunctionLike(node)) {
				pushScope();
				walkFunctionParams(node);
				if (node.body) {
					walkScope(node.body);
				}
				return;
			}

			if (ts.isCatchClause(node)) {
				pushScope();
				const { variableDeclaration: p } = node;
				if (p && ts.isIdentifier(p)) {
					registerLocalBinding(p);
				}
				walkScope(node.block);
				return;
			}

			if (ts.isBlock(node) && !isFunctionLike(parent)) {
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
					references.push(node);
				}
			}
		}

		function leave(node: ts.Node) {
			parent && parentStack.pop();
			if (
				(ts.isBlock(node) && !isFunctionLike(parent)) ||
				isFunctionLike(node)
			) {
				popScope();
			}
		}
	}

	function isFunctionLike(node: ts.Node) {
		return ts.isArrowFunction(node)
			|| ts.isConstructorDeclaration(node)
			|| ts.isFunctionExpression(node)
			|| ts.isFunctionDeclaration(node)
			|| ts.isMethodDeclaration(node)
			|| ts.isAccessor(node);
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
			ts.isInterfaceDeclaration(parent) ||
			ts.isTypeAliasDeclaration(parent) ||
			ts.isPropertySignature(parent)
		) {
			return false;
		}

		if (
			ts.isPropertyAccessExpression(parent) ||
			ts.isPropertyAssignment(parent) ||
			ts.isPropertyDeclaration(parent) ||
			ts.isMethodDeclaration(parent) ||
			ts.isAccessor(parent)
		) {
			if (parent.name === id) {
				return false;
			}
		}

		return true;
	}
}
	
export function extractIdentifiers(ts: typeof import('typescript'), node: ts.Node, includesRest = true) {
	return extract(node, []);

	function extract(node: ts.Node, nodes: ts.Identifier[] = []) {
		if (ts.isIdentifier(node)) {
			nodes.push(node);
		}
		else if (
			ts.isParameter(node) ||
			ts.isBindingElement(node) &&
			(includesRest || !node.dotDotDotToken)
		) {
			extract(node.name, nodes);
		}
		else if (ts.isObjectBindingPattern(node) || ts.isArrayBindingPattern(node)) {
			node.elements.map((el) => extract(el, nodes));
		}
		return nodes;
	}
}