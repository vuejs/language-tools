import type { ts, TypeScript } from '@vue/language-core';

/**
 * The value declarations of one source file and the identifiers that refer to them, resolved by lexical scope.
 * Identifiers that resolve to no declaration of the file (globals, other modules' exports) have no symbol.
 */
export interface SameFileSymbols {
	/** The names of the declarations that the identifier at `position` refers to. */
	getDeclarations(position: number): readonly ts.Identifier[];
	/** The identifiers that refer to what the identifier at `position` refers to, its declarations among them, in source order. */
	getReferences(position: number): readonly ts.Identifier[];
}

interface LocalSymbol {
	declarations: ts.Identifier[];
	references: ts.Identifier[];
}

const useStrictDirective = 'use strict';

export function resolveSameFileSymbols(ts: TypeScript, sourceFile: ts.SourceFile): SameFileSymbols {
	/** The locals that each scope declares by name. */
	const locals = new Map<ts.Node, Map<string, LocalSymbol>>();
	/** The names of function and class expressions, which resolve after the locals of the expression. */
	const expressionNames = new Map<ts.Node, LocalSymbol>();
	const symbols = new Map<ts.Identifier, LocalSymbol>();

	forEachValueIdentifier(sourceFile, declare);
	forEachValueIdentifier(sourceFile, id => {
		if (!symbols.has(id) && isValueReference(id)) {
			const symbol = resolve(id);
			if (symbol) {
				symbols.set(id, symbol);
				symbol.references.push(id);
			}
		}
	});
	for (const symbol of new Set(symbols.values())) {
		symbol.references.sort((a, b) => a.pos - b.pos);
	}

	return {
		getDeclarations: position => getSymbol(position)?.declarations ?? [],
		getReferences: position => getSymbol(position)?.references ?? [],
	};

	function getSymbol(position: number) {
		const token = ts.getTouchingPropertyName(sourceFile, position);
		return ts.isIdentifier(token) ? symbols.get(token) : undefined;
	}

	function declare(id: ts.Identifier) {
		const scope = getDeclarationScope(id);
		if (!scope) {
			return;
		}
		let symbol: LocalSymbol | undefined;
		if (ts.isFunctionExpression(scope) || ts.isClassExpression(scope)) {
			symbol = { declarations: [], references: [] };
			expressionNames.set(scope, symbol);
		}
		else {
			let scopeLocals = locals.get(scope);
			if (!scopeLocals) {
				locals.set(scope, scopeLocals = new Map());
			}
			symbol = scopeLocals.get(id.text);
			if (!symbol) {
				scopeLocals.set(id.text, symbol = { declarations: [], references: [] });
			}
		}
		symbol.declarations.push(id);
		symbol.references.push(id);
		symbols.set(id, symbol);
	}

	function resolve(id: ts.Identifier) {
		for (let node: ts.Node | undefined = id.parent; node; node = node.parent) {
			const local = locals.get(node)?.get(id.text);
			if (local) {
				return local;
			}
			const expressionName = expressionNames.get(node);
			if (expressionName?.declarations[0]!.text === id.text) {
				return expressionName;
			}
		}
	}

	/** The scope that declares `id` if it names a value declaration: a variable, parameter, function, class, enum, namespace or import. */
	function getDeclarationScope(id: ts.Identifier): ts.Node | undefined {
		const { parent } = id;
		if (ts.isVariableDeclaration(parent) || ts.isParameterDeclaration(parent) || ts.isBindingElement(parent)) {
			if (parent.name !== id) {
				return;
			}
			const declaration = getBindingRoot(parent);
			if (ts.isParameterDeclaration(declaration)) {
				return declaration.parent;
			}
			const list = declaration.parent;
			if (
				ts.isVariableDeclarationList(list)
				&& !(list.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const | ts.NodeFlags.Using))
			) {
				return getVarScope(list);
			}
			return getBlockScope(declaration);
		}
		if (ts.isFunctionDeclaration(parent)) {
			return isStrict(parent) ? getBlockScope(parent) : getVarScope(parent);
		}
		if (
			ts.isClassDeclaration(parent)
			|| ts.isEnumDeclaration(parent)
			|| ts.isModuleDeclaration(parent)
			|| ts.isImportClause(parent)
			|| ts.isNamespaceImport(parent)
			|| ts.isImportSpecifier(parent)
			|| ts.isImportEqualsDeclaration(parent)
		) {
			return parent.name === id ? getBlockScope(parent) : undefined;
		}
		if (ts.isFunctionExpression(parent) || ts.isClassExpression(parent)) {
			return parent.name === id ? parent : undefined;
		}
	}

	function getBindingRoot(node: ts.Node): ts.VariableDeclaration | ts.ParameterDeclaration {
		while (!ts.isVariableDeclaration(node) && !ts.isParameterDeclaration(node)) {
			node = node.parent;
		}
		return node;
	}

	/** The nearest scope of `let`, `const`, classes, and functions in strict code. */
	function getBlockScope(node: ts.Node) {
		for (let scope = node.parent; scope; scope = scope.parent) {
			if (
				isVarScope(scope)
				|| (ts.isBlock(scope) && !ts.isFunctionLikeDeclaration(scope.parent)
					&& !ts.isClassStaticBlockDeclaration(scope.parent))
				|| ts.isCaseBlock(scope)
				|| ts.isForStatement(scope)
				|| ts.isForInStatement(scope)
				|| ts.isForOfStatement(scope)
				|| ts.isCatchClause(scope)
			) {
				return scope;
			}
		}
	}

	/** The nearest scope of `var`. */
	function getVarScope(node: ts.Node) {
		for (let scope = node.parent; scope; scope = scope.parent) {
			if (isVarScope(scope)) {
				return scope;
			}
		}
	}

	function isVarScope(node: ts.Node) {
		return ts.isSourceFile(node)
			|| ts.isModuleBlock(node)
			|| ts.isClassStaticBlockDeclaration(node)
			|| ts.isFunctionLikeDeclaration(node);
	}

	/** Modules, class bodies and code under a `'use strict'` directive. */
	function isStrict(node: ts.Node) {
		for (let scope = node.parent; scope; scope = scope.parent) {
			if (ts.isClassDeclaration(scope) || ts.isClassExpression(scope)) {
				return true;
			}
			if (ts.isSourceFile(scope)) {
				return ts.isExternalModule(scope) || hasUseStrictDirective(scope.statements);
			}
			if (ts.isBlock(scope) && ts.isFunctionLikeDeclaration(scope.parent) && hasUseStrictDirective(scope.statements)) {
				return true;
			}
		}
		return false;
	}

	function hasUseStrictDirective(statements: readonly ts.Statement[]) {
		for (const statement of statements) {
			if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) {
				return false;
			}
			if (statement.expression.text === useStrictDirective) {
				return true;
			}
		}
		return false;
	}

	/** Whether `id`, which declares nothing, names a value in scope rather than a property, a label or an export of another module. */
	function isValueReference(id: ts.Identifier) {
		const { parent } = id;
		if (ts.isPropertyAccessExpression(parent)) {
			return parent.name !== id;
		}
		if (ts.isQualifiedName(parent)) {
			return parent.right !== id;
		}
		if (
			ts.isPropertyAssignment(parent)
			|| ts.isPropertyDeclaration(parent)
			|| ts.isPropertySignatureDeclaration(parent)
			|| ts.isMethodDeclaration(parent)
			|| ts.isMethodSignatureDeclaration(parent)
			|| ts.isGetAccessorDeclaration(parent)
			|| ts.isSetAccessorDeclaration(parent)
			|| ts.isEnumMember(parent)
			|| ts.isJsxAttribute(parent)
			|| ts.isImportAttribute(parent)
		) {
			return parent.name !== id;
		}
		if (ts.isBindingElement(parent) || ts.isImportSpecifier(parent)) {
			return parent.propertyName !== id;
		}
		if (ts.isExportSpecifier(parent)) {
			const declaration = parent.parent.parent;
			return ts.isExportDeclaration(declaration) && !declaration.moduleSpecifier
				&& (parent.propertyName ?? parent.name) === id;
		}
		if (
			ts.isJsxOpeningElement(parent)
			|| ts.isJsxSelfClosingElement(parent)
			|| ts.isJsxClosingElement(parent)
		) {
			return parent.tagName !== id || !isIntrinsicJsxName(id.text);
		}
		return !ts.isLabeledStatement(parent)
			&& !ts.isBreakStatement(parent)
			&& !ts.isContinueStatement(parent)
			&& !ts.isMetaProperty(parent)
			&& !ts.isNamespaceExport(parent)
			&& !ts.isNamespaceExportDeclaration(parent)
			&& !ts.isJsxNamespacedName(parent);
	}

	/** Visits the identifiers outside types, and those that types read as values (`typeof x`, computed names). */
	function forEachValueIdentifier(node: ts.Node, cb: (id: ts.Identifier) => void, inType = false) {
		if (ts.isIdentifier(node)) {
			if (!inType) {
				cb(node);
			}
			return;
		}
		if (ts.isTypeQueryNode(node)) {
			forEachValueIdentifier(node.exprName, cb);
			for (const typeArgument of node.typeArguments ?? []) {
				forEachValueIdentifier(typeArgument, cb, true);
			}
			return;
		}
		if (ts.isComputedPropertyName(node)) {
			forEachValueIdentifier(node.expression, cb);
			return;
		}
		if (ts.isExpressionWithTypeArguments(node) && !isTypeHeritage(node)) {
			forEachValueIdentifier(node.expression, cb, inType);
			for (const typeArgument of node.typeArguments ?? []) {
				forEachValueIdentifier(typeArgument, cb, true);
			}
			return;
		}
		const childInType = inType
			|| ts.isTypeNode(node)
			|| ts.isInterfaceDeclaration(node)
			|| ts.isTypeAliasDeclaration(node)
			|| ts.isTypeParameterDeclaration(node);
		node.forEachChild(child => {
			forEachValueIdentifier(child, cb, childInType);
		});
	}

	/** An `implements` clause or an interface's `extends` clause, which name types; a class's `extends` names a value. */
	function isTypeHeritage(node: ts.ExpressionWithTypeArguments) {
		const { parent } = node;
		return ts.isHeritageClause(parent)
			&& (parent.token === ts.SyntaxKind.ImplementsKeyword || ts.isInterfaceDeclaration(parent.parent));
	}
}

/** JSX tag names that start with a lowercase letter or contain a dash name elements, not values. */
function isIntrinsicJsxName(name: string) {
	return /^[a-z]/.test(name) || name.includes('-');
}
