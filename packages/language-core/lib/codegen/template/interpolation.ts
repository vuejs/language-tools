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
	{ typescript, destructuredProps, importedComponents, setupRefs, setupBindings }: {
		typescript: typeof import('typescript');
		destructuredProps: Set<string>;
		importedComponents: Set<string>;
		setupRefs: Set<string>;
		setupBindings: Set<string>;
	},
	ctx: TemplateCodegenContext,
	block: IRBlock,
	data: VueCodeInformation,
	code: string,
	start: number,
	prefix: string = '',
	suffix: string = '',
	forceDotValue: boolean = false,
): Generator<Code> {
	if (prefix) {
		yield prefix;
	}

	let prevEnd = 0;
	for (
		const [name, offset, isShorthand, isNarrowing] of forEachIdentifiers(
			typescript,
			ctx,
			block,
			code,
			prefix,
			suffix,
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
			if (isNarrowing || forceDotValue) {
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
): Generator<[string, number, boolean, boolean]> {
	if (identifierRE.test(code) && !shouldIdentifierSkipped(ctx, code)) {
		yield [code, 0, false, false];
		return;
	}

	const scope = ctx.scope();
	const ast = getTypeScriptAST(ts, block, prefix + code + suffix);
	for (const [id, isShorthand, isNarrowing] of forEachDeclarations(ts, ast, ast, ctx, scope, false)) {
		const text = getNodeText(ts, id, ast);
		if (shouldIdentifierSkipped(ctx, text)) {
			continue;
		}
		yield [text, getStartEnd(ts, id, ast).start - prefix.length, isShorthand, isNarrowing];
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
): Generator<[ts.Identifier, boolean, boolean]> {
	if (ts.isIdentifier(node)) {
		yield [node, false, inNarrowing];
	}
	else if (ts.isShorthandPropertyAssignment(node)) {
		yield [node.name, true, inNarrowing];
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
		for (const arg of node.arguments) {
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
		yield* forEachDeclarationsInTypeNode(ts, node.type);
		yield* forEachDeclarations(ts, node.expression, ast, ctx, scope, inNarrowing);
	}
	else if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
		yield* forEachDeclarations(ts, node.expression, ast, ctx, scope, inNarrowing);
		yield* forEachDeclarationsInTypeNode(ts, node.type);
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
		yield* forEachDeclarations(ts, node.left, ast, ctx, scope, isLogical || isAssignment || isEquality || isInstanceof);
		yield* forEachDeclarations(ts, node.right, ast, ctx, scope, isLogical || isEquality || isIn);
	}
	else if (ts.isConditionalExpression(node)) {
		yield* forEachDeclarations(ts, node.condition, ast, ctx, scope, true);
		yield* forEachDeclarations(ts, node.whenTrue, ast, ctx, scope, false);
		yield* forEachDeclarations(ts, node.whenFalse, ast, ctx, scope, false);
	}
	else if (ts.isPrefixUnaryExpression(node)) {
		yield* forEachDeclarations(
			ts,
			node.operand,
			ast,
			ctx,
			scope,
			node.operator === ts.SyntaxKind.ExclamationToken,
		);
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
				yield* forEachDeclarationsInFunction(ts, prop, ast, ctx);
			}
		}
	}
	// fix https://github.com/vuejs/language-tools/issues/1422
	else if (ts.isTypeNode(node)) {
		yield* forEachDeclarationsInTypeNode(ts, node);
	}
	else if (ts.isBlock(node)) {
		const scope = ctx.scope();
		for (const child of forEachNode(ts, node)) {
			yield* forEachDeclarations(ts, child, ast, ctx, scope, false);
		}
		scope.end();
	}
	else {
		for (const child of forEachNode(ts, node)) {
			yield* forEachDeclarations(ts, child, ast, ctx, scope, false);
		}
	}
}

function* forEachDeclarationsInBinding(
	ts: typeof import('typescript'),
	node: ts.BindingElement | ts.ParameterDeclaration | ts.VariableDeclaration,
	ast: ts.SourceFile,
	ctx: TemplateCodegenContext,
	scope: ReturnType<TemplateCodegenContext['scope']>,
): Generator<[ts.Identifier, boolean, boolean]> {
	if ('type' in node && node.type) {
		yield* forEachDeclarationsInTypeNode(ts, node.type);
	}
	if (!ts.isIdentifier(node.name)) {
		yield* forEachDeclarations(ts, node.name, ast, ctx, scope, false);
	}
	if (node.initializer) {
		yield* forEachDeclarations(ts, node.initializer, ast, ctx, scope, false);
	}
}

function* forEachDeclarationsInFunction(
	ts: typeof import('typescript'),
	node: ts.ArrowFunction | ts.FunctionExpression | ts.AccessorDeclaration | ts.MethodDeclaration,
	ast: ts.SourceFile,
	ctx: TemplateCodegenContext,
): Generator<[ts.Identifier, boolean, boolean]> {
	const scope = ctx.scope();
	for (const param of node.parameters) {
		scope.declare(...collectBindingNames(ts, param.name, ast));
		yield* forEachDeclarationsInBinding(ts, param, ast, ctx, scope);
	}
	if (node.body) {
		yield* forEachDeclarations(ts, node.body, ast, ctx, scope, false);
	}
	scope.end();
}

function* forEachDeclarationsInTypeNode(
	ts: typeof import('typescript'),
	node: ts.Node,
): Generator<[ts.Identifier, boolean, boolean]> {
	if (ts.isTypeQueryNode(node)) {
		let id = node.exprName;
		while (!ts.isIdentifier(id)) {
			id = id.left;
		}
		yield [id, false, false];
	}
	else {
		for (const child of forEachNode(ts, node)) {
			yield* forEachDeclarationsInTypeNode(ts, child);
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
