import { isGloballyAllowed, makeMap } from '@vue/shared';
import type * as ts from 'typescript';
import { collectBindingNames } from '../../utils/collectBindings';
import { getNodeText } from '../../utils/shared';
import { forEachNode } from '../utils';
import type { TemplateCodegenContext } from './context';

// https://github.com/vuejs/core/blob/fb0c3ca519f1fccf52049cd6b8db3a67a669afe9/packages/compiler-core/src/transforms/transformExpression.ts#L47
const isLiteralWhitelisted = /*@__PURE__*/ makeMap('true,false,null,this');

export interface DeclarationItem {
	id: ts.Identifier;
	isShorthand: boolean;
	skipped: boolean;
}

export function* forEachDeclarations(
	ts: typeof import('typescript'),
	node: ts.Node,
	ast: ts.SourceFile,
	ctx: TemplateCodegenContext,
	scope: ReturnType<TemplateCodegenContext['scope']>,
): Generator<DeclarationItem> {
	if (ts.isIdentifier(node)) {
		yield {
			id: node,
			isShorthand: false,
			skipped: shouldIdentifierSkipped(ctx, getNodeText(ts, node, ast)),
		};
	}
	else if (ts.isShorthandPropertyAssignment(node)) {
		yield {
			id: node.name,
			isShorthand: true,
			skipped: shouldIdentifierSkipped(ctx, getNodeText(ts, node.name, ast)),
		};
	}
	else if (ts.isPropertyAccessExpression(node)) {
		yield* forEachDeclarations(ts, node.expression, ast, ctx, scope);
	}
	else if (ts.isElementAccessExpression(node)) {
		yield* forEachDeclarations(ts, node.expression, ast, ctx, scope);
		yield* forEachDeclarations(ts, node.argumentExpression, ast, ctx, scope);
	}
	else if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
		yield* forEachDeclarations(ts, node.expression, ast, ctx, scope);
		if (node.typeArguments) {
			for (const typeArg of node.typeArguments) {
				yield* forEachDeclarationsInTypeNode(ts, typeArg, ast, ctx, scope);
			}
		}
		for (const arg of node.arguments ?? []) {
			yield* forEachDeclarations(ts, arg, ast, ctx, scope);
		}
	}
	else if (ts.isTypeAssertionExpression(node)) {
		yield* forEachDeclarationsInTypeNode(ts, node.type, ast, ctx, scope);
		yield* forEachDeclarations(ts, node.expression, ast, ctx, scope);
	}
	else if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
		yield* forEachDeclarations(ts, node.expression, ast, ctx, scope);
		yield* forEachDeclarationsInTypeNode(ts, node.type, ast, ctx, scope);
	}
	else if (ts.isBinaryExpression(node)) {
		if (
			node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
			&& node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
		) {
			yield* forEachDeclarationsInAssignmentTarget(ts, node.left, ast, ctx, scope);
		}
		else {
			yield* forEachDeclarations(ts, node.left, ast, ctx, scope);
		}
		yield* forEachDeclarations(ts, node.right, ast, ctx, scope);
	}
	else if (ts.isVariableDeclaration(node)) {
		scope.declare(...collectBindingNames(ts, node.name, ast));
		yield* forEachDeclarationsInBinding(ts, node, ast, ctx, scope);
	}
	else if (ts.isArrayBindingPattern(node) || ts.isObjectBindingPattern(node)) {
		for (const element of node.elements) {
			if (ts.isBindingElement(element)) {
				yield* forEachDeclarationsInBinding(ts, element, ast, ctx, scope);
			}
		}
	}
	else if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
		yield* forEachDeclarationsInFunction(ts, node, ast, ctx);
	}
	else if (ts.isFunctionDeclaration(node)) {
		if (node.name) {
			scope.declare(getNodeText(ts, node.name, ast));
		}
		yield* forEachDeclarationsInFunction(ts, node, ast, ctx);
	}
	else if (ts.isClassDeclaration(node)) {
		if (node.name) {
			scope.declare(getNodeText(ts, node.name, ast));
		}
		yield* forEachDeclarationsInClass(ts, node, ast, ctx, scope);
	}
	else if (ts.isClassExpression(node)) {
		const classScope = ctx.scope();
		if (node.name) {
			classScope.declare(getNodeText(ts, node.name, ast));
		}
		yield* forEachDeclarationsInClass(ts, node, ast, ctx, classScope);
		classScope.end();
	}
	else if (ts.isObjectLiteralExpression(node)) {
		for (const prop of node.properties) {
			if (ts.isPropertyAssignment(prop)) {
				// fix https://github.com/vuejs/language-tools/issues/1176
				if (ts.isComputedPropertyName(prop.name)) {
					yield* forEachDeclarations(ts, prop.name.expression, ast, ctx, scope);
				}
				yield* forEachDeclarations(ts, prop.initializer, ast, ctx, scope);
			}
			// fix https://github.com/vuejs/language-tools/issues/1156
			else if (ts.isShorthandPropertyAssignment(prop)) {
				yield* forEachDeclarations(ts, prop, ast, ctx, scope);
			}
			// fix https://github.com/vuejs/language-tools/issues/1148#issuecomment-1094378126
			else if (ts.isSpreadAssignment(prop)) {
				// TODO: cannot report "Spread types may only be created from object types.ts(2698)"
				yield* forEachDeclarations(ts, prop.expression, ast, ctx, scope);
			}
			// fix https://github.com/vuejs/language-tools/issues/4604
			else if (ts.isFunctionLike(prop) && prop.body) {
				if (prop.name && ts.isComputedPropertyName(prop.name)) {
					yield* forEachDeclarations(ts, prop.name.expression, ast, ctx, scope);
				}
				yield* forEachDeclarationsInFunction(ts, prop, ast, ctx);
			}
		}
	}
	// fix https://github.com/vuejs/language-tools/issues/1422
	else if (ts.isTypeNode(node)) {
		yield* forEachDeclarationsInTypeNode(ts, node, ast, ctx, scope);
	}
	else if (ts.isBlock(node)) {
		const scope = ctx.scope();
		predeclareFunctionDeclarations(ts, node.statements, ast, scope);
		for (const child of forEachNode(ts, node)) {
			yield* forEachDeclarations(ts, child, ast, ctx, scope);
		}
		scope.end();
	}
	else if (ts.isForOfStatement(node) || ts.isForInStatement(node)) {
		const scope = ctx.scope();
		if (ts.isVariableDeclarationList(node.initializer)) {
			for (const decl of node.initializer.declarations) {
				yield* forEachDeclarations(ts, decl, ast, ctx, scope);
			}
		}
		else {
			yield* forEachDeclarationsInAssignmentTarget(ts, node.initializer, ast, ctx, scope);
		}
		yield* forEachDeclarations(ts, node.expression, ast, ctx, scope);
		yield* forEachDeclarations(ts, node.statement, ast, ctx, scope);
		scope.end();
	}
	else if (ts.isForStatement(node)) {
		const scope = ctx.scope();
		if (node.initializer) {
			if (ts.isVariableDeclarationList(node.initializer)) {
				for (const decl of node.initializer.declarations) {
					scope.declare(...collectBindingNames(ts, decl.name, ast));
					if (decl.initializer) {
						yield* forEachDeclarations(ts, decl.initializer, ast, ctx, scope);
					}
				}
			}
			else {
				yield* forEachDeclarations(ts, node.initializer, ast, ctx, scope);
			}
		}
		if (node.condition) {
			yield* forEachDeclarations(ts, node.condition, ast, ctx, scope);
		}
		if (node.incrementor) {
			yield* forEachDeclarations(ts, node.incrementor, ast, ctx, scope);
		}
		yield* forEachDeclarations(ts, node.statement, ast, ctx, scope);
		scope.end();
	}
	else if (ts.isSwitchStatement(node)) {
		predeclareFunctionDeclarations(ts, node.caseBlock.clauses.flatMap(clause => [...clause.statements]), ast, scope);
		yield* forEachDeclarations(ts, node.expression, ast, ctx, scope);
		for (const clause of node.caseBlock.clauses) {
			if (ts.isCaseClause(clause)) {
				yield* forEachDeclarations(ts, clause.expression, ast, ctx, scope);
			}
			for (const statement of clause.statements) {
				yield* forEachDeclarations(ts, statement, ast, ctx, scope);
			}
		}
	}
	else if (ts.isLabeledStatement(node)) {
		yield* forEachDeclarations(ts, node.statement, ast, ctx, scope);
	}
	else if (isBreakOrContinueStatement(ts, node)) {
		// break/continue labels are not bindings.
	}
	else if (ts.isMetaProperty(node)) {
		// `new.target` / `import.meta` are not bindings.
	}
	else if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
		yield* forEachDeclarationsInTypeNode(ts, node, ast, ctx, scope);
	}
	else if (ts.isEnumDeclaration(node)) {
		scope.declare(getNodeText(ts, node.name, ast));
		for (const member of node.members) {
			if (member.initializer) {
				yield* forEachDeclarations(ts, member.initializer, ast, ctx, scope);
			}
		}
	}
	else if (ts.isModuleDeclaration(node)) {
		if (node.body && ts.isModuleBlock(node.body)) {
			const scope = ctx.scope();
			predeclareFunctionDeclarations(ts, node.body.statements, ast, scope);
			for (const statement of node.body.statements) {
				yield* forEachDeclarations(ts, statement, ast, ctx, scope);
			}
			scope.end();
		}
		else if (node.body && ts.isModuleDeclaration(node.body)) {
			yield* forEachDeclarations(ts, node.body, ast, ctx, scope);
		}
	}
	else if (ts.isCatchClause(node)) {
		const scope = ctx.scope();
		if (node.variableDeclaration) {
			yield* forEachDeclarations(ts, node.variableDeclaration, ast, ctx, scope);
		}
		if (node.block) {
			yield* forEachDeclarations(ts, node.block, ast, ctx, scope);
		}
		scope.end();
	}
	else if (ts.isSourceFile(node)) {
		predeclareFunctionDeclarations(ts, node.statements, ast, scope);
		for (const statement of node.statements) {
			yield* forEachDeclarations(ts, statement, ast, ctx, scope);
		}
	}
	else {
		for (const child of forEachNode(ts, node)) {
			yield* forEachDeclarations(ts, child, ast, ctx, scope);
		}
	}
}

function predeclareFunctionDeclarations(
	ts: typeof import('typescript'),
	statements: readonly ts.Statement[],
	ast: ts.SourceFile,
	scope: ReturnType<TemplateCodegenContext['scope']>,
) {
	for (const statement of statements) {
		if (ts.isFunctionDeclaration(statement) && statement.name) {
			scope.declare(getNodeText(ts, statement.name, ast));
		}
	}
}

function* forEachDeclarationsInAssignmentTarget(
	ts: typeof import('typescript'),
	node: ts.Node,
	ast: ts.SourceFile,
	ctx: TemplateCodegenContext,
	scope: ReturnType<TemplateCodegenContext['scope']>,
): Generator<DeclarationItem> {
	if (ts.isIdentifier(node)) {
		yield {
			id: node,
			isShorthand: false,
			skipped: shouldIdentifierSkipped(ctx, getNodeText(ts, node, ast)),
		};
	}
	else if (ts.isObjectLiteralExpression(node)) {
		for (const prop of node.properties) {
			if (ts.isPropertyAssignment(prop)) {
				if (ts.isComputedPropertyName(prop.name)) {
					yield* forEachDeclarations(ts, prop.name.expression, ast, ctx, scope);
				}
				yield* forEachDeclarationsInAssignmentTarget(ts, prop.initializer, ast, ctx, scope);
			}
			else if (ts.isShorthandPropertyAssignment(prop)) {
				yield {
					id: prop.name,
					isShorthand: true,
					skipped: shouldIdentifierSkipped(ctx, getNodeText(ts, prop.name, ast)),
				};
				if (prop.objectAssignmentInitializer) {
					yield* forEachDeclarations(ts, prop.objectAssignmentInitializer, ast, ctx, scope);
				}
			}
			else if (ts.isSpreadAssignment(prop)) {
				yield* forEachDeclarationsInAssignmentTarget(ts, prop.expression, ast, ctx, scope);
			}
		}
	}
	else if (ts.isArrayLiteralExpression(node)) {
		for (const element of node.elements) {
			if (ts.isOmittedExpression(element)) {
				continue;
			}
			else if (ts.isSpreadElement(element)) {
				yield* forEachDeclarationsInAssignmentTarget(ts, element.expression, ast, ctx, scope);
			}
			else if (ts.isBinaryExpression(element)) {
				yield* forEachDeclarationsInAssignmentTarget(ts, element.left, ast, ctx, scope);
				yield* forEachDeclarations(ts, element.right, ast, ctx, scope);
			}
			else {
				yield* forEachDeclarationsInAssignmentTarget(ts, element, ast, ctx, scope);
			}
		}
	}
	else if (ts.isParenthesizedExpression(node)) {
		yield* forEachDeclarationsInAssignmentTarget(ts, node.expression, ast, ctx, scope);
	}
	else {
		yield* forEachDeclarations(ts, node, ast, ctx, scope);
	}
}

function* forEachDeclarationsInBinding(
	ts: typeof import('typescript'),
	node: ts.BindingElement | ts.ParameterDeclaration | ts.VariableDeclaration,
	ast: ts.SourceFile,
	ctx: TemplateCodegenContext,
	scope: ReturnType<TemplateCodegenContext['scope']>,
): Generator<DeclarationItem> {
	if ('propertyName' in node && node.propertyName && ts.isComputedPropertyName(node.propertyName)) {
		yield* forEachDeclarations(ts, node.propertyName.expression, ast, ctx, scope);
	}
	if (!ts.isIdentifier(node.name)) {
		yield* forEachDeclarations(ts, node.name, ast, ctx, scope);
	}
	if ('type' in node && node.type) {
		yield* forEachDeclarationsInTypeNode(ts, node.type, ast, ctx, scope);
	}
	if (node.initializer) {
		yield* forEachDeclarations(ts, node.initializer, ast, ctx, scope);
	}
}

function* forEachDeclarationsInFunction(
	ts: typeof import('typescript'),
	node:
		| ts.ArrowFunction
		| ts.FunctionExpression
		| ts.FunctionDeclaration
		| ts.MethodDeclaration
		| ts.AccessorDeclaration
		| ts.ConstructorDeclaration,
	ast: ts.SourceFile,
	ctx: TemplateCodegenContext,
): Generator<DeclarationItem> {
	const scope = ctx.scope();
	if (ts.isFunctionExpression(node) && node.name) {
		scope.declare(getNodeText(ts, node.name, ast));
	}
	for (const param of node.parameters) {
		scope.declare(...collectBindingNames(ts, param.name, ast));
	}
	if (node.typeParameters) {
		for (const typeParam of node.typeParameters) {
			yield* forEachDeclarationsInTypeNode(ts, typeParam, ast, ctx, scope);
		}
	}
	for (const param of node.parameters) {
		yield* forEachDeclarationsInBinding(ts, param, ast, ctx, scope);
	}
	if (node.type) {
		yield* forEachDeclarationsInTypeNode(ts, node.type, ast, ctx, scope);
	}
	if (node.body) {
		yield* forEachDeclarations(ts, node.body, ast, ctx, scope);
	}
	scope.end();
}

function* forEachDeclarationsInClass(
	ts: typeof import('typescript'),
	node: ts.ClassDeclaration | ts.ClassExpression,
	ast: ts.SourceFile,
	ctx: TemplateCodegenContext,
	scope: ReturnType<TemplateCodegenContext['scope']>,
): Generator<DeclarationItem> {
	for (const typeParam of node.typeParameters ?? []) {
		yield* forEachDeclarationsInTypeNode(ts, typeParam, ast, ctx, scope);
	}
	for (const clause of node.heritageClauses ?? []) {
		if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
			for (const type of clause.types) {
				yield* forEachDeclarations(ts, type.expression, ast, ctx, scope);
				if (type.typeArguments) {
					for (const typeArg of type.typeArguments) {
						yield* forEachDeclarationsInTypeNode(ts, typeArg, ast, ctx, scope);
					}
				}
			}
		}
		else {
			yield* forEachDeclarationsInTypeNode(ts, clause, ast, ctx, scope);
		}
	}
	for (const member of node.members) {
		if (
			ts.isPropertyDeclaration(member)
			|| ts.isMethodDeclaration(member)
			|| ts.isGetAccessorDeclaration(member)
			|| ts.isSetAccessorDeclaration(member)
		) {
			if (member.name && ts.isComputedPropertyName(member.name)) {
				yield* forEachDeclarations(ts, member.name.expression, ast, ctx, scope);
			}
		}
		if (
			ts.isConstructorDeclaration(member)
			|| ts.isMethodDeclaration(member)
			|| ts.isGetAccessorDeclaration(member)
			|| ts.isSetAccessorDeclaration(member)
		) {
			yield* forEachDeclarationsInFunction(ts, member, ast, ctx);
		}
		else if (ts.isPropertyDeclaration(member)) {
			if (member.type) {
				yield* forEachDeclarationsInTypeNode(ts, member.type, ast, ctx, scope);
			}
			if (member.initializer) {
				yield* forEachDeclarations(ts, member.initializer, ast, ctx, scope);
			}
		}
		else if (ts.isClassStaticBlockDeclaration(member)) {
			const blockScope = ctx.scope();
			predeclareFunctionDeclarations(ts, member.body.statements, ast, blockScope);
			for (const statement of member.body.statements) {
				yield* forEachDeclarations(ts, statement, ast, ctx, blockScope);
			}
			blockScope.end();
		}
	}
}

function* forEachDeclarationsInTypeNode(
	ts: typeof import('typescript'),
	node: ts.Node,
	ast: ts.SourceFile,
	ctx: TemplateCodegenContext,
	scope: ReturnType<TemplateCodegenContext['scope']>,
): Generator<DeclarationItem> {
	if (ts.isTypeQueryNode(node)) {
		let id = node.exprName;
		while (!ts.isIdentifier(id)) {
			id = id.left;
		}
		yield {
			id,
			isShorthand: false,
			skipped: shouldIdentifierSkipped(ctx, getNodeText(ts, id, ast)),
		};
	}
	else if (ts.isComputedPropertyName(node)) {
		yield* forEachDeclarations(ts, node.expression, ast, ctx, scope);
	}
	else {
		for (const child of forEachNode(ts, node)) {
			yield* forEachDeclarationsInTypeNode(ts, child, ast, ctx, scope);
		}
	}
}

export function shouldIdentifierSkipped(
	ctx: TemplateCodegenContext,
	text: string,
) {
	return ctx.scopes.some(scope => scope.has(text))
		// https://github.com/vuejs/core/blob/245230e135152900189f13a4281302de45fdcfaa/packages/compiler-core/src/transforms/transformExpression.ts#L342-L352
		|| isGloballyAllowed(text)
		|| isLiteralWhitelisted(text)
		|| text === 'require'
		|| text.startsWith('__VLS_');
}

// vue-tsc runs against TypeScript's tsc bundle, which does not include
// type guards that the compiler itself never uses, so check `kind` directly.

function isBreakOrContinueStatement(
	ts: typeof import('typescript'),
	node: ts.Node,
): node is ts.BreakOrContinueStatement {
	return node.kind === ts.SyntaxKind.BreakStatement || node.kind === ts.SyntaxKind.ContinueStatement;
}
