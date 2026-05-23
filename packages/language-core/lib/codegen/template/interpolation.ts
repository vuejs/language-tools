import { isGloballyAllowed, makeMap } from '@vue/shared';
import type * as ts from 'typescript';
import type { Code, IRBlock, VueCodeInformation } from '../../types';
import { collectBindingNames } from '../../utils/collectBindings';
import { getNodeText, getStartEnd } from '../../utils/shared';
import { codeFeatures } from '../codeFeatures';
import { names } from '../names';
import { forEachNode, getTypeScriptAST, identifierRegex } from '../utils';
import { endBoundary, startBoundary } from '../utils/boundary';
import type { TemplateCodegenContext } from './context';

// https://github.com/vuejs/core/blob/fb0c3ca519f1fccf52049cd6b8db3a67a669afe9/packages/compiler-core/src/transforms/transformExpression.ts#L47
const isLiteralWhitelisted = /*@__PURE__*/ makeMap('true,false,null,this');

export function* generateInterpolation(
	{ typescript, setupRefs }: {
		typescript: typeof import('typescript');
		setupRefs: Set<string>;
	},
	ctx: TemplateCodegenContext,
	block: IRBlock,
	data: VueCodeInformation,
	code: string,
	start: number,
	prefix: string = '',
	suffix: string = '',
): Generator<Code> {
	if (prefix) {
		yield prefix;
	}

	let prevEnd = 0;
	for (
		const [name, offset, isShorthand] of forEachIdentifiers(
			typescript,
			ctx,
			block,
			code,
			prefix,
			suffix,
		)
	) {
		if (isShorthand) {
			yield [
				code.slice(prevEnd, offset + name.length),
				block.name,
				start + prevEnd,
				data,
			];
			yield `: `;
		}
		else if (prevEnd < offset) {
			yield [
				code.slice(prevEnd, offset),
				block.name,
				start + prevEnd,
				data,
			];
		}

		if (setupRefs.has(name)) {
			yield [
				name,
				block.name,
				start + offset,
				data,
			];
			yield `.value`;
		}
		else {
			// #1205, #1264
			const token = yield* startBoundary(
				block.name,
				start + offset,
				codeFeatures.verification,
			);
			if (ctx.dollarVars.has(name)) {
				yield names.dollars;
			}
			else {
				ctx.recordComponentAccess(block.name, name, start + offset);
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
			yield endBoundary(token, start + offset + name.length);
		}

		prevEnd = offset + name.length;
	}

	if (prevEnd < code.length) {
		yield [
			code.slice(prevEnd),
			block.name,
			start + prevEnd,
			data,
		];
	}

	if (suffix) {
		yield suffix;
	}
}

function* forEachIdentifiers(
	ts: typeof import('typescript'),
	ctx: TemplateCodegenContext,
	block: IRBlock,
	code: string,
	prefix: string,
	suffix: string,
): Generator<[string, number, boolean]> {
	if (
		identifierRegex.test(code) && !shouldIdentifierSkipped(ctx, code)
	) {
		yield [code, 0, false];
		return;
	}

	const endScope = ctx.startScope();
	const ast = getTypeScriptAST(ts, block, prefix + code + suffix);
	for (const [id, isShorthand] of forEachDeclarations(ts, ast, ast, ctx)) {
		const text = getNodeText(ts, id, ast);
		if (shouldIdentifierSkipped(ctx, text)) {
			continue;
		}
		yield [text, getStartEnd(ts, id, ast).start - prefix.length, isShorthand];
	}
	endScope();
}

function* forEachDeclarations(
	ts: typeof import('typescript'),
	node: ts.Node,
	ast: ts.SourceFile,
	ctx: TemplateCodegenContext,
): Generator<[ts.Identifier, boolean]> {
	if (ts.isIdentifier(node)) {
		yield [node, false];
	}
	else if (ts.isShorthandPropertyAssignment(node)) {
		yield [node.name, true];
	}
	else if (ts.isPropertyAccessExpression(node)) {
		yield* forEachDeclarations(ts, node.expression, ast, ctx);
	}
	else if (ts.isVariableDeclaration(node)) {
		ctx.declare(...collectBindingNames(ts, node.name, ast));
		yield* forEachDeclarationsInBinding(ts, node, ast, ctx);
	}
	else if (ts.isArrayBindingPattern(node) || ts.isObjectBindingPattern(node)) {
		for (const element of node.elements) {
			if (ts.isBindingElement(element)) {
				yield* forEachDeclarationsInBinding(ts, element, ast, ctx);
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
					yield* forEachDeclarations(ts, prop.name.expression, ast, ctx);
				}
				yield* forEachDeclarations(ts, prop.initializer, ast, ctx);
			}
			// fix https://github.com/vuejs/language-tools/issues/1156
			else if (ts.isShorthandPropertyAssignment(prop)) {
				yield* forEachDeclarations(ts, prop, ast, ctx);
			}
			// fix https://github.com/vuejs/language-tools/issues/1148#issuecomment-1094378126
			else if (ts.isSpreadAssignment(prop)) {
				// TODO: cannot report "Spread types may only be created from object types.ts(2698)"
				yield* forEachDeclarations(ts, prop.expression, ast, ctx);
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
		const endScope = ctx.startScope();
		for (const child of forEachNode(ts, node)) {
			yield* forEachDeclarations(ts, child, ast, ctx);
		}
		endScope();
	}
	else {
		for (const child of forEachNode(ts, node)) {
			yield* forEachDeclarations(ts, child, ast, ctx);
		}
	}
}

function* forEachDeclarationsInBinding(
	ts: typeof import('typescript'),
	node: ts.BindingElement | ts.ParameterDeclaration | ts.VariableDeclaration,
	ast: ts.SourceFile,
	ctx: TemplateCodegenContext,
): Generator<[ts.Identifier, boolean]> {
	if ('type' in node && node.type) {
		yield* forEachDeclarationsInTypeNode(ts, node.type);
	}
	if (!ts.isIdentifier(node.name)) {
		yield* forEachDeclarations(ts, node.name, ast, ctx);
	}
	if (node.initializer) {
		yield* forEachDeclarations(ts, node.initializer, ast, ctx);
	}
}

function* forEachDeclarationsInFunction(
	ts: typeof import('typescript'),
	node: ts.ArrowFunction | ts.FunctionExpression | ts.AccessorDeclaration | ts.MethodDeclaration,
	ast: ts.SourceFile,
	ctx: TemplateCodegenContext,
): Generator<[ts.Identifier, boolean]> {
	const endScope = ctx.startScope();
	for (const param of node.parameters) {
		ctx.declare(...collectBindingNames(ts, param.name, ast));
		yield* forEachDeclarationsInBinding(ts, param, ast, ctx);
	}
	if (node.body) {
		yield* forEachDeclarations(ts, node.body, ast, ctx);
	}
	endScope();
}

function* forEachDeclarationsInTypeNode(
	ts: typeof import('typescript'),
	node: ts.Node,
): Generator<[ts.Identifier, boolean]> {
	if (ts.isTypeQueryNode(node)) {
		let id = node.exprName;
		while (!ts.isIdentifier(id)) {
			id = id.left;
		}
		yield [id, false];
	}
	else {
		for (const child of forEachNode(ts, node)) {
			yield* forEachDeclarationsInTypeNode(ts, child);
		}
	}
}

function shouldIdentifierSkipped(
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
