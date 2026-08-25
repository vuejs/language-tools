import { isGloballyAllowed, makeMap } from '@vue/shared';
import type * as ts from 'typescript';
import type { Code, IRBlock, VueCodeInformation } from '../../types';
import { collectBindingNames } from '../../utils/collectBindings';
import { getNodeText, getStartEnd } from '../../utils/shared';
import { codeFeatures } from '../codeFeatures';
import { names } from '../names';
import { forEachNode, getTypeScriptAST, identifierRE } from '../utils';
import { Boundary } from '../utils/boundary';
import type { TemplateCodegenContext } from './context';

// https://github.com/vuejs/core/blob/fb0c3ca519f1fccf52049cd6b8db3a67a669afe9/packages/compiler-core/src/transforms/transformExpression.ts#L47
const isLiteralWhitelisted = /*@__PURE__*/ makeMap('true,false,null,this');

export function* generateInterpolation(
	{ typescript, destructuredProps, importedComponents, setupRefs, setupBindings, setupNonNarrowableBindings }: {
		typescript: typeof import('typescript');
		destructuredProps: Set<string>;
		importedComponents: Set<string>;
		setupRefs: Set<string>;
		setupBindings: Set<string>;
		setupNonNarrowableBindings: Set<string>;
	},
	ctx: TemplateCodegenContext,
	block: IRBlock,
	data: VueCodeInformation,
	code: string,
	start: number,
	prefix: string = '',
	suffix: string = '',
	inNarrowing: boolean = false,
): Generator<Code> {
	if (prefix) {
		yield prefix;
	}

	let prevEnd = 0;
	for (
		const [name, offset, isShorthand, isNarrowing, inTypeQuery, isNewOperand] of forEachIdentifiers(
			typescript,
			ctx,
			block,
			code,
			prefix,
			suffix,
			inNarrowing,
		)
	) {
		if (isShorthand) {
			yield* generateNonIdentifierCode(
				code.slice(prevEnd, offset + name.length),
				block.name,
				start + prevEnd,
				data,
				prevEnd > 0,
			);
			yield `: `;
		}
		else if (prevEnd < offset) {
			yield* generateNonIdentifierCode(
				code.slice(prevEnd, offset),
				block.name,
				start + prevEnd,
				data,
				prevEnd > 0,
			);
		}

		// Access strategy, in precedence order:
		// - destructured props / imported components → direct reference
		// - template refs → direct `.value`
		// - type query on binding → `.value` (non-narrowable stays bare)
		// - other bindings → `.value` (narrowing / write) or `__VLS_unwrap` (value read)
		// - otherwise → `__VLS_ctx.<name>`
		if (destructuredProps.has(name) || importedComponents.has(name)) {
			yield [
				name,
				block.name,
				start + offset,
				isShorthand
					? { ...data, __shorthandExpression: 'js' }
					: data,
			];
		}
		else if (setupRefs.has(name)) {
			yield [
				name,
				block.name,
				start + offset,
				data,
			];
			yield `.value`;
		}
		else if (setupBindings.has(name)) {
			ctx.accessVariable(block.name, name, start + offset);
			if (inTypeQuery) {
				yield [
					name,
					block.name,
					start + offset,
					isShorthand
						? { ...data, __shorthandExpression: 'js' }
						: data,
				];
				if (!setupNonNarrowableBindings.has(name)) {
					yield `.value`;
				}
			}
			else if (!setupNonNarrowableBindings.has(name) && (isNarrowing || ctx.isNarrowed(name))) {
				yield [
					name,
					block.name,
					start + offset,
					isShorthand
						? { ...data, __shorthandExpression: 'js' }
						: data,
				];
				yield `.value`;
			}
			else {
				// A `new` operand must stay parenthesized: `new __VLS_unwrap(Foo)()`
				// parses as `new (__VLS_unwrap(Foo)())`, whose target lacks a
				// construct signature.
				if (isNewOperand) {
					yield `(`;
				}
				yield `${names.unwrap}(`;
				yield [
					name,
					block.name,
					start + offset,
					isShorthand
						? { ...data, __shorthandExpression: 'js' }
						: data,
				];
				yield `)`;
				if (isNewOperand) {
					yield `)`;
				}
			}
		}
		else {
			// #1205, #1264
			const boundary = yield* Boundary.start(
				block.name,
				start + offset,
				start + offset + name.length,
				codeFeatures.verification,
			);
			if (ctx.dollarVars.has(name)) {
				yield names.dollars;
			}
			else {
				ctx.accessVariable(block.name, name, start + offset);
				yield names.ctx;
			}
			yield `.`;
			yield [
				name,
				block.name,
				start + offset,
				isShorthand
					? { ...data, __shorthandExpression: 'js' }
					: data,
			];
			yield boundary.end();
		}

		prevEnd = offset + name.length;
	}

	if (prevEnd < code.length) {
		yield* generateNonIdentifierCode(
			code.slice(prevEnd),
			block.name,
			start + prevEnd,
			data,
			prevEnd > 0,
		);
	}

	if (suffix) {
		yield suffix;
	}
}

/**
 * Yield a code chunk, cutting the boundary character off as verification-only.
 *
 * Adjacent mappings share the boundary offset (closed interval), so both the
 * neighbouring token's end and this chunk's start claim the same source offset.
 * Downgrading the boundary character to verification-only keeps content-sensitive
 * features (rename / navigation) from firing on the neighbouring chunk.
 */
function* generateNonIdentifierCode(
	code: string,
	source: string,
	offset: number,
	data: VueCodeInformation,
	shouldCut = true,
): Generator<Code> {
	if (!code.length) {
		return;
	}
	if (!shouldCut) {
		yield [code, source, offset, data];
		return;
	}
	yield [code.slice(0, 1), source, offset, { verification: data.verification }];
	if (code.length > 1) {
		yield [code.slice(1), source, offset + 1, data];
	}
}

function* forEachIdentifiers(
	ts: typeof import('typescript'),
	ctx: TemplateCodegenContext,
	block: IRBlock,
	code: string,
	prefix: string,
	suffix: string,
	inNarrowing: boolean,
): Generator<[string, number, boolean, boolean, boolean, boolean]> {
	if (identifierRE.test(code) && !shouldIdentifierSkipped(ctx, code)) {
		yield [code, 0, false, inNarrowing, false, false];
		return;
	}

	const scope = ctx.scope();
	const ast = getTypeScriptAST(ts, block, prefix + code + suffix);
	for (
		const [id, isShorthand, isNarrowing, skipped, inTypeQuery, isNewOperand] of forEachDeclarations(
			ts,
			ast,
			ast,
			ctx,
			scope,
			inNarrowing,
		)
	) {
		if (skipped) {
			continue;
		}
		const text = getNodeText(ts, id, ast);
		yield [text, getStartEnd(ts, id, ast).start - prefix.length, isShorthand, isNarrowing, inTypeQuery, isNewOperand];
	}
	scope.end();
}

function* forEachDeclarations(
	ts: typeof import('typescript'),
	node: ts.Node,
	ast: ts.SourceFile,
	ctx: TemplateCodegenContext,
	scope: ReturnType<TemplateCodegenContext['scope']>,
	inNarrowing: boolean,
): Generator<[ts.Identifier, boolean, boolean, boolean, boolean, boolean]> {
	if (ts.isIdentifier(node)) {
		yield [node, false, inNarrowing, shouldIdentifierSkipped(ctx, getNodeText(ts, node, ast)), false, false];
	}
	else if (ts.isShorthandPropertyAssignment(node)) {
		yield [node.name, true, inNarrowing, shouldIdentifierSkipped(ctx, getNodeText(ts, node.name, ast)), false, false];
	}
	else if (ts.isPropertyAccessExpression(node)) {
		yield* forEachDeclarations(ts, node.expression, ast, ctx, scope, true);
	}
	else if (ts.isElementAccessExpression(node)) {
		yield* forEachDeclarations(ts, node.expression, ast, ctx, scope, true);
		yield* forEachDeclarations(ts, node.argumentExpression, ast, ctx, scope, false);
	}
	else if (ts.isCallExpression(node)) {
		yield* forEachDeclarations(ts, node.expression, ast, ctx, scope, false);
		if (node.typeArguments) {
			for (const typeArg of node.typeArguments) {
				yield* forEachDeclarationsInTypeNode(ts, typeArg, ast, ctx);
			}
		}
		for (const arg of node.arguments) {
			yield* forEachDeclarations(ts, arg, ast, ctx, scope, inNarrowing);
		}
	}
	else if (ts.isNewExpression(node)) {
		if (ts.isIdentifier(node.expression)) {
			yield [
				node.expression,
				false,
				false,
				shouldIdentifierSkipped(ctx, getNodeText(ts, node.expression, ast)),
				false,
				true,
			];
		}
		else {
			yield* forEachDeclarations(ts, node.expression, ast, ctx, scope, false);
		}
		if (node.typeArguments) {
			for (const typeArg of node.typeArguments) {
				yield* forEachDeclarationsInTypeNode(ts, typeArg, ast, ctx);
			}
		}
		for (const arg of node.arguments ?? []) {
			yield* forEachDeclarations(ts, arg, ast, ctx, scope, inNarrowing);
		}
	}
	else if (ts.isTaggedTemplateExpression(node)) {
		yield* forEachDeclarations(ts, node.tag, ast, ctx, scope, false);
		yield* forEachDeclarations(ts, node.template, ast, ctx, scope, inNarrowing);
	}
	else if (ts.isParenthesizedExpression(node)) {
		yield* forEachDeclarations(ts, node.expression, ast, ctx, scope, inNarrowing);
	}
	else if (ts.isNonNullExpression(node)) {
		yield* forEachDeclarations(ts, node.expression, ast, ctx, scope, inNarrowing);
	}
	else if (ts.isTypeAssertionExpression(node)) {
		yield* forEachDeclarationsInTypeNode(ts, node.type, ast, ctx);
		yield* forEachDeclarations(ts, node.expression, ast, ctx, scope, inNarrowing);
	}
	else if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
		yield* forEachDeclarations(ts, node.expression, ast, ctx, scope, inNarrowing);
		yield* forEachDeclarationsInTypeNode(ts, node.type, ast, ctx);
	}
	else if (ts.isBinaryExpression(node)) {
		const isLogical = node.operatorToken.kind === ts.SyntaxKind.BarBarToken
			|| node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
			|| node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken;
		const isAssignment = node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
			&& node.operatorToken.kind <= ts.SyntaxKind.LastAssignment;
		const isEquality = node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken
			|| node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken
			|| node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken
			|| node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken;
		const isInstanceof = node.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword;
		const isIn = node.operatorToken.kind === ts.SyntaxKind.InKeyword;
		if (isLogical) {
			const left = [...forEachDeclarations(ts, node.left, ast, ctx, scope, true)];
			for (const item of left) {
				yield item;
			}
			ctx.enterNarrowedScope();
			for (const [id, , , skipped] of left) {
				if (!skipped) {
					ctx.addNarrowedBinding(getNodeText(ts, id, ast));
				}
			}
			yield* forEachDeclarations(ts, node.right, ast, ctx, scope, true);
			ctx.exitNarrowedScope();
		}
		else if (isAssignment) {
			let left = node.left;
			while (ts.isParenthesizedExpression(left)) {
				left = left.expression;
			}
			if (ts.isObjectLiteralExpression(left) || ts.isArrayLiteralExpression(left)) {
				yield* forEachDeclarationsInAssignmentTarget(ts, left, ast, ctx, scope);
			}
			else {
				yield* forEachDeclarations(ts, node.left, ast, ctx, scope, true);
			}
			yield* forEachDeclarations(ts, node.right, ast, ctx, scope, false);
		}
		else {
			yield* forEachDeclarations(ts, node.left, ast, ctx, scope, isEquality || isInstanceof);
			yield* forEachDeclarations(ts, node.right, ast, ctx, scope, isEquality || isIn);
		}
	}
	else if (ts.isConditionalExpression(node)) {
		const condition = [...forEachDeclarations(ts, node.condition, ast, ctx, scope, true)];
		for (const item of condition) {
			yield item;
		}
		ctx.enterNarrowedScope();
		for (const [id, , , skipped] of condition) {
			if (!skipped) {
				ctx.addNarrowedBinding(getNodeText(ts, id, ast));
			}
		}
		yield* forEachDeclarations(ts, node.whenTrue, ast, ctx, scope, false);
		yield* forEachDeclarations(ts, node.whenFalse, ast, ctx, scope, false);
		ctx.exitNarrowedScope();
	}
	else if (ts.isPrefixUnaryExpression(node)) {
		yield* forEachDeclarations(
			ts,
			node.operand,
			ast,
			ctx,
			scope,
			node.operator === ts.SyntaxKind.ExclamationToken
				|| node.operator === ts.SyntaxKind.PlusPlusToken
				|| node.operator === ts.SyntaxKind.MinusMinusToken,
		);
	}
	else if (ts.isPostfixUnaryExpression(node)) {
		yield* forEachDeclarations(ts, node.operand, ast, ctx, scope, true);
	}
	else if (ts.isTypeOfExpression(node)) {
		yield* forEachDeclarations(ts, node.expression, ast, ctx, scope, true);
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
		// A named class expression's name is only visible inside the class body,
		// so it gets its own scope instead of leaking into the surrounding one.
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
					yield* forEachDeclarations(ts, prop.name.expression, ast, ctx, scope, false);
				}
				yield* forEachDeclarations(ts, prop.initializer, ast, ctx, scope, false);
			}
			// fix https://github.com/vuejs/language-tools/issues/1156
			else if (ts.isShorthandPropertyAssignment(prop)) {
				yield* forEachDeclarations(ts, prop, ast, ctx, scope, false);
			}
			// fix https://github.com/vuejs/language-tools/issues/1148#issuecomment-1094378126
			else if (ts.isSpreadAssignment(prop)) {
				// TODO: cannot report "Spread types may only be created from object types.ts(2698)"
				yield* forEachDeclarations(ts, prop.expression, ast, ctx, scope, false);
			}
			// fix https://github.com/vuejs/language-tools/issues/4604
			else if (ts.isFunctionLike(prop) && prop.body) {
				if (prop.name && ts.isComputedPropertyName(prop.name)) {
					yield* forEachDeclarations(ts, prop.name.expression, ast, ctx, scope, false);
				}
				yield* forEachDeclarationsInFunction(ts, prop, ast, ctx);
			}
		}
	}
	// fix https://github.com/vuejs/language-tools/issues/1422
	else if (ts.isTypeNode(node)) {
		yield* forEachDeclarationsInTypeNode(ts, node, ast, ctx);
	}
	else if (ts.isBlock(node)) {
		const scope = ctx.scope();
		for (const child of forEachNode(ts, node)) {
			yield* forEachDeclarations(ts, child, ast, ctx, scope, false);
		}
		scope.end();
	}
	else if (ts.isForOfStatement(node) || ts.isForInStatement(node)) {
		const scope = ctx.scope();
		if (ts.isVariableDeclarationList(node.initializer)) {
			for (const decl of node.initializer.declarations) {
				scope.declare(...collectBindingNames(ts, decl.name, ast));
				if (decl.initializer) {
					yield* forEachDeclarations(ts, decl.initializer, ast, ctx, scope, false);
				}
			}
		}
		else if (ts.isIdentifier(node.initializer)) {
			yield [
				node.initializer,
				false,
				true,
				shouldIdentifierSkipped(ctx, getNodeText(ts, node.initializer, ast)),
				false,
				false,
			];
		}
		else if (ts.isObjectLiteralExpression(node.initializer) || ts.isArrayLiteralExpression(node.initializer)) {
			yield* forEachDeclarationsInAssignmentTarget(ts, node.initializer, ast, ctx, scope);
		}
		else if (ts.isPropertyAccessExpression(node.initializer)) {
			yield* forEachDeclarations(ts, node.initializer.expression, ast, ctx, scope, true);
		}
		else if (ts.isElementAccessExpression(node.initializer)) {
			yield* forEachDeclarations(ts, node.initializer.expression, ast, ctx, scope, true);
			yield* forEachDeclarations(ts, node.initializer.argumentExpression, ast, ctx, scope, false);
		}
		yield* forEachDeclarations(ts, node.expression, ast, ctx, scope, false);
		yield* forEachDeclarations(ts, node.statement, ast, ctx, scope, false);
		scope.end();
	}
	else if (ts.isIfStatement(node)) {
		const condition = [...forEachDeclarations(ts, node.expression, ast, ctx, scope, true)];
		for (const item of condition) {
			yield item;
		}
		ctx.enterNarrowedScope();
		for (const [id, , , skipped] of condition) {
			if (!skipped) {
				ctx.addNarrowedBinding(getNodeText(ts, id, ast));
			}
		}
		yield* forEachDeclarations(ts, node.thenStatement, ast, ctx, scope, false);
		if (node.elseStatement) {
			yield* forEachDeclarations(ts, node.elseStatement, ast, ctx, scope, false);
		}
		ctx.exitNarrowedScope();
	}
	else if (ts.isWhileStatement(node)) {
		const condition = [...forEachDeclarations(ts, node.expression, ast, ctx, scope, true)];
		for (const item of condition) {
			yield item;
		}
		ctx.enterNarrowedScope();
		for (const [id, , , skipped] of condition) {
			if (!skipped) {
				ctx.addNarrowedBinding(getNodeText(ts, id, ast));
			}
		}
		yield* forEachDeclarations(ts, node.statement, ast, ctx, scope, false);
		ctx.exitNarrowedScope();
	}
	else if (ts.isDoStatement(node)) {
		yield* forEachDeclarations(ts, node.statement, ast, ctx, scope, false);
		yield* forEachDeclarations(ts, node.expression, ast, ctx, scope, true);
	}
	else if (ts.isForStatement(node)) {
		const scope = ctx.scope();
		if (node.initializer) {
			if (ts.isVariableDeclarationList(node.initializer)) {
				for (const decl of node.initializer.declarations) {
					scope.declare(...collectBindingNames(ts, decl.name, ast));
					if (decl.initializer) {
						yield* forEachDeclarations(ts, decl.initializer, ast, ctx, scope, false);
					}
				}
			}
			else {
				yield* forEachDeclarations(ts, node.initializer, ast, ctx, scope, false);
			}
		}
		let condition: [ts.Identifier, boolean, boolean, boolean, boolean, boolean][] = [];
		if (node.condition) {
			condition = [...forEachDeclarations(ts, node.condition, ast, ctx, scope, true)];
			for (const item of condition) {
				yield item;
			}
		}
		// The incrementor runs after each successful condition check, so the
		// condition's narrowing applies to it as well as to the body.
		ctx.enterNarrowedScope();
		for (const [id, , , skipped] of condition) {
			if (!skipped) {
				ctx.addNarrowedBinding(getNodeText(ts, id, ast));
			}
		}
		if (node.incrementor) {
			yield* forEachDeclarations(ts, node.incrementor, ast, ctx, scope, false);
		}
		yield* forEachDeclarations(ts, node.statement, ast, ctx, scope, false);
		ctx.exitNarrowedScope();
		scope.end();
	}
	else if (ts.isSwitchStatement(node)) {
		const expression = [...forEachDeclarations(ts, node.expression, ast, ctx, scope, true)];
		for (const item of expression) {
			yield item;
		}
		ctx.enterNarrowedScope();
		for (const [id, , , skipped] of expression) {
			if (!skipped) {
				ctx.addNarrowedBinding(getNodeText(ts, id, ast));
			}
		}
		for (const clause of node.caseBlock.clauses) {
			if (ts.isCaseClause(clause)) {
				yield* forEachDeclarations(ts, clause.expression, ast, ctx, scope, false);
			}
			for (const statement of clause.statements) {
				yield* forEachDeclarations(ts, statement, ast, ctx, scope, false);
			}
		}
		ctx.exitNarrowedScope();
	}
	else if (ts.isLabeledStatement(node)) {
		yield* forEachDeclarations(ts, node.statement, ast, ctx, scope, false);
	}
	else if (ts.isBreakStatement(node) || ts.isContinueStatement(node)) {
		// never yield the label: `break outer` / `continue outer` target a label,
		// not a binding.
	}
	else if (ts.isMetaProperty(node)) {
		// `new.target` / `import.meta` are not bindings.
	}
	else if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
		yield* forEachDeclarationsInTypeNode(ts, node, ast, ctx);
	}
	else if (ts.isEnumDeclaration(node)) {
		scope.declare(getNodeText(ts, node.name, ast));
		for (const member of node.members) {
			if (member.initializer) {
				yield* forEachDeclarations(ts, member.initializer, ast, ctx, scope, false);
			}
		}
	}
	else if (ts.isModuleDeclaration(node)) {
		if (node.body && ts.isModuleBlock(node.body)) {
			const scope = ctx.scope();
			for (const statement of node.body.statements) {
				yield* forEachDeclarations(ts, statement, ast, ctx, scope, false);
			}
			scope.end();
		}
		else if (node.body && ts.isModuleDeclaration(node.body)) {
			yield* forEachDeclarations(ts, node.body, ast, ctx, scope, false);
		}
	}
	else if (ts.isCatchClause(node)) {
		const scope = ctx.scope();
		if (node.variableDeclaration) {
			yield* forEachDeclarations(ts, node.variableDeclaration, ast, ctx, scope, false);
		}
		if (node.block) {
			yield* forEachDeclarations(ts, node.block, ast, ctx, scope, false);
		}
		scope.end();
	}
	else if (ts.isSourceFile(node)) {
		for (const statement of node.statements) {
			yield* forEachDeclarations(ts, statement, ast, ctx, scope, inNarrowing);
		}
	}
	else if (ts.isExpressionStatement(node)) {
		yield* forEachDeclarations(ts, node.expression, ast, ctx, scope, inNarrowing);
	}
	else {
		for (const child of forEachNode(ts, node)) {
			yield* forEachDeclarations(ts, child, ast, ctx, scope, false);
		}
	}
}

function* forEachDeclarationsInAssignmentTarget(
	ts: typeof import('typescript'),
	node: ts.Node,
	ast: ts.SourceFile,
	ctx: TemplateCodegenContext,
	scope: ReturnType<TemplateCodegenContext['scope']>,
): Generator<[ts.Identifier, boolean, boolean, boolean, boolean, boolean]> {
	if (ts.isIdentifier(node)) {
		yield [node, false, true, shouldIdentifierSkipped(ctx, getNodeText(ts, node, ast)), false, false];
	}
	else if (ts.isObjectLiteralExpression(node)) {
		for (const prop of node.properties) {
			if (ts.isPropertyAssignment(prop)) {
				if (ts.isComputedPropertyName(prop.name)) {
					yield* forEachDeclarations(ts, prop.name.expression, ast, ctx, scope, false);
				}
				yield* forEachDeclarationsInAssignmentTarget(ts, prop.initializer, ast, ctx, scope);
			}
			else if (ts.isShorthandPropertyAssignment(prop)) {
				yield [prop.name, true, true, shouldIdentifierSkipped(ctx, getNodeText(ts, prop.name, ast)), false, false];
				if (prop.objectAssignmentInitializer) {
					yield* forEachDeclarations(ts, prop.objectAssignmentInitializer, ast, ctx, scope, false);
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
				yield* forEachDeclarations(ts, element.right, ast, ctx, scope, false);
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
		yield* forEachDeclarations(ts, node, ast, ctx, scope, true);
	}
}

function* forEachDeclarationsInBinding(
	ts: typeof import('typescript'),
	node: ts.BindingElement | ts.ParameterDeclaration | ts.VariableDeclaration,
	ast: ts.SourceFile,
	ctx: TemplateCodegenContext,
	scope: ReturnType<TemplateCodegenContext['scope']>,
): Generator<[ts.Identifier, boolean, boolean, boolean, boolean, boolean]> {
	if (!ts.isIdentifier(node.name)) {
		yield* forEachDeclarations(ts, node.name, ast, ctx, scope, false);
	}
	if ('type' in node && node.type) {
		yield* forEachDeclarationsInTypeNode(ts, node.type, ast, ctx);
	}
	if (node.initializer) {
		yield* forEachDeclarations(ts, node.initializer, ast, ctx, scope, false);
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
): Generator<[ts.Identifier, boolean, boolean, boolean, boolean, boolean]> {
	const scope = ctx.scope();
	if (ts.isFunctionExpression(node) && node.name) {
		// A named function expression's name is only visible inside its own body.
		scope.declare(getNodeText(ts, node.name, ast));
	}
	for (const param of node.parameters) {
		scope.declare(...collectBindingNames(ts, param.name, ast));
	}
	if (node.typeParameters) {
		for (const typeParam of node.typeParameters) {
			yield* forEachDeclarationsInTypeNode(ts, typeParam, ast, ctx);
		}
	}
	for (const param of node.parameters) {
		yield* forEachDeclarationsInBinding(ts, param, ast, ctx, scope);
	}
	if (node.type) {
		yield* forEachDeclarationsInTypeNode(ts, node.type, ast, ctx);
	}
	if (node.body) {
		yield* forEachDeclarations(ts, node.body, ast, ctx, scope, false);
	}
	scope.end();
}

function* forEachDeclarationsInClass(
	ts: typeof import('typescript'),
	node: ts.ClassDeclaration | ts.ClassExpression,
	ast: ts.SourceFile,
	ctx: TemplateCodegenContext,
	scope: ReturnType<TemplateCodegenContext['scope']>,
): Generator<[ts.Identifier, boolean, boolean, boolean, boolean, boolean]> {
	for (const clause of node.heritageClauses ?? []) {
		if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
			for (const type of clause.types) {
				yield* forEachDeclarations(ts, type.expression, ast, ctx, scope, false);
				if (type.typeArguments) {
					for (const typeArg of type.typeArguments) {
						yield* forEachDeclarationsInTypeNode(ts, typeArg, ast, ctx);
					}
				}
			}
		}
		else {
			yield* forEachDeclarationsInTypeNode(ts, clause, ast, ctx);
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
				yield* forEachDeclarations(ts, member.name.expression, ast, ctx, scope, false);
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
			if (member.initializer) {
				yield* forEachDeclarations(ts, member.initializer, ast, ctx, scope, false);
			}
		}
		else if (ts.isClassStaticBlockDeclaration(member)) {
			const blockScope = ctx.scope();
			for (const statement of member.body.statements) {
				yield* forEachDeclarations(ts, statement, ast, ctx, blockScope, false);
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
): Generator<[ts.Identifier, boolean, boolean, boolean, boolean, boolean]> {
	if (ts.isTypeQueryNode(node)) {
		let id = node.exprName;
		while (!ts.isIdentifier(id)) {
			id = id.left;
		}
		yield [id, false, false, shouldIdentifierSkipped(ctx, getNodeText(ts, id, ast)), true, false];
	}
	else {
		for (const child of forEachNode(ts, node)) {
			yield* forEachDeclarationsInTypeNode(ts, child, ast, ctx);
		}
	}
}

export function collectNarrowedBindingNames(
	typescript: typeof import('typescript'),
	block: IRBlock,
	setupBindings: Set<string>,
	setupNonNarrowableBindings: Set<string>,
	ctx: TemplateCodegenContext,
	code: string,
): Set<string> {
	const names = new Set<string>();
	const scope = ctx.scope();
	const ast = getTypeScriptAST(typescript, block, code);
	for (const [id, , isNarrowing, skipped] of forEachDeclarations(typescript, ast, ast, ctx, scope, true)) {
		if (!isNarrowing || skipped) {
			continue;
		}
		const text = getNodeText(typescript, id, ast);
		if (setupBindings.has(text) && !setupNonNarrowableBindings.has(text)) {
			names.add(text);
		}
	}
	scope.end();
	return names;
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
