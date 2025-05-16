import { isGloballyAllowed, makeMap } from '@vue/shared';
import type * as ts from 'typescript';
import type { Code, VueCodeInformation } from '../../types';
import { getNodeText, getStartEnd } from '../../utils/shared';
import { collectVars, createTsAst, identifierRegex } from '../utils';
import type { TemplateCodegenContext } from './context';

// https://github.com/vuejs/core/blob/fb0c3ca519f1fccf52049cd6b8db3a67a669afe9/packages/compiler-core/src/transforms/transformExpression.ts#L47
const isLiteralWhitelisted = /*@__PURE__*/ makeMap('true,false,null,this');

export function* generateInterpolation(
	options: {
		ts: typeof ts,
		destructuredPropNames: Set<string> | undefined,
		templateRefNames: Set<string> | undefined;
	},
	ctx: TemplateCodegenContext,
	source: string,
	data: VueCodeInformation | ((offset: number) => VueCodeInformation) | undefined,
	code: string,
	start: number | undefined,
	astHolder: any = {},
	prefix: string = '',
	suffix: string = ''
): Generator<Code> {
	for (let [section, offset, type] of forEachInterpolationSegment(
		options.ts,
		options.destructuredPropNames,
		options.templateRefNames,
		ctx,
		code,
		start,
		astHolder,
		prefix,
		suffix
	)) {
		if (offset === undefined) {
			yield section;
		}
		else {
			offset -= prefix.length;
			let addSuffix = '';
			const overLength = offset + section.length - code.length;
			if (overLength > 0) {
				addSuffix = section.slice(section.length - overLength);
				section = section.slice(0, -overLength);
			}
			if (offset < 0) {
				yield section.slice(0, -offset);
				section = section.slice(-offset);
				offset = 0;
			}
			const shouldSkip = section.length === 0 && (type === 'startText' || type === 'endText');
			if (!shouldSkip) {
				if (
					start !== undefined
					&& data
				) {
					yield [
						section,
						source,
						start + offset,
						type === 'errorMappingOnly'
							? ctx.codeFeatures.verification
							: typeof data === 'function' ? data(start + offset) : data,
					];
				}
				else {
					yield section;
				}
			}
			yield addSuffix;
		}
	}
}

interface CtxVar {
	text: string;
	offset: number;
	isShorthand?: boolean;
};

type Segment = [
	fragment: string,
	offset: number | undefined,
	type?: 'errorMappingOnly' | 'startText' | 'endText',
];

function* forEachInterpolationSegment(
	ts: typeof import('typescript'),
	destructuredPropNames: Set<string> | undefined,
	templateRefNames: Set<string> | undefined,
	ctx: TemplateCodegenContext,
	originalCode: string,
	start: number | undefined,
	astHolder: any,
	prefix: string,
	suffix: string
): Generator<Segment> {
	const code = prefix + originalCode + suffix;
	const offset = start !== undefined ? start - prefix.length : undefined;
	let ctxVars: CtxVar[] = [];

	if (identifierRegex.test(originalCode) && !shouldIdentifierSkipped(ctx, originalCode, destructuredPropNames)) {
		ctxVars.push({
			text: originalCode,
			offset: prefix.length,
		});
	}
	else {
		const ast = createTsAst(ts, astHolder, code);
		const varCb = (id: ts.Identifier, isShorthand: boolean) => {
			const text = getNodeText(ts, id, ast);
			if (!shouldIdentifierSkipped(ctx, text, destructuredPropNames)) {
				ctxVars.push({
					text,
					offset: getStartEnd(ts, id, ast).start,
					isShorthand,
				});
			}
		};
		ts.forEachChild(ast, node => walkIdentifiers(ts, node, ast, varCb, ctx));
	}

	ctxVars = ctxVars.sort((a, b) => a.offset - b.offset);

	if (ctxVars.length) {
		for (let i = 0; i < ctxVars.length; i++) {
			const lastVar = ctxVars[i - 1];
			const curVar = ctxVars[i];
			const lastVarEnd = lastVar ? lastVar.offset + lastVar.text.length : 0;

			if (curVar.isShorthand) {
				yield [code.slice(lastVarEnd, curVar.offset + curVar.text.length), lastVarEnd];
				yield [': ', undefined];
			}
			else {
				yield [code.slice(lastVarEnd, curVar.offset), lastVarEnd, i ? undefined : 'startText'];
			}
			yield* generateVar(templateRefNames, ctx, code, offset, curVar);
		}

		const lastVar = ctxVars.at(-1)!;
		if (lastVar.offset + lastVar.text.length < code.length) {
			yield [code.slice(lastVar.offset + lastVar.text.length), lastVar.offset + lastVar.text.length, 'endText'];
		}
	}
	else {
		yield [code, 0];
	}
}

function* generateVar(
	templateRefNames: Set<string> | undefined,
	ctx: TemplateCodegenContext,
	code: string,
	offset: number | undefined,
	curVar: CtxVar
): Generator<Segment> {
	// fix https://github.com/vuejs/language-tools/issues/1205
	// fix https://github.com/vuejs/language-tools/issues/1264
	yield ['', curVar.offset, 'errorMappingOnly'];

	const isTemplateRef = templateRefNames?.has(curVar.text) ?? false;
	if (isTemplateRef) {
		yield [`__VLS_unref(`, undefined];
		yield [code.slice(curVar.offset, curVar.offset + curVar.text.length), curVar.offset];
		yield [`)`, undefined];
	}
	else {
		if (offset !== undefined) {
			ctx.accessExternalVariable(curVar.text, offset + curVar.offset);
		}
		else {
			ctx.accessExternalVariable(curVar.text);
		}

		if (ctx.dollarVars.has(curVar.text)) {
			yield [`__VLS_dollars.`, undefined];
		}
		yield [`__VLS_ctx.`, undefined];
		yield [code.slice(curVar.offset, curVar.offset + curVar.text.length), curVar.offset];
	}
}

function walkIdentifiers(
	ts: typeof import('typescript'),
	node: ts.Node,
	ast: ts.SourceFile,
	cb: (varNode: ts.Identifier, isShorthand: boolean) => void,
	ctx: TemplateCodegenContext,
	blockVars: string[] = [],
	isRoot: boolean = true
) {

	if (ts.isIdentifier(node)) {
		cb(node, false);
	}
	else if (ts.isShorthandPropertyAssignment(node)) {
		cb(node.name, true);
	}
	else if (ts.isPropertyAccessExpression(node)) {
		walkIdentifiers(ts, node.expression, ast, cb, ctx, blockVars, false);
	}
	else if (ts.isVariableDeclaration(node)) {

		collectVars(ts, node.name, ast, blockVars);

		for (const varName of blockVars) {
			ctx.addLocalVariable(varName);
		}

		if (node.initializer) {
			walkIdentifiers(ts, node.initializer, ast, cb, ctx, blockVars, false);
		}
	}
	else if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
		processFunction(ts, node, ast, cb, ctx);
	}
	else if (ts.isObjectLiteralExpression(node)) {
		for (const prop of node.properties) {
			if (ts.isPropertyAssignment(prop)) {
				// fix https://github.com/vuejs/language-tools/issues/1176
				if (ts.isComputedPropertyName(prop.name)) {
					walkIdentifiers(ts, prop.name.expression, ast, cb, ctx, blockVars, false);
				}
				walkIdentifiers(ts, prop.initializer, ast, cb, ctx, blockVars, false);
			}
			// fix https://github.com/vuejs/language-tools/issues/1156
			else if (ts.isShorthandPropertyAssignment(prop)) {
				walkIdentifiers(ts, prop, ast, cb, ctx, blockVars, false);
			}
			// fix https://github.com/vuejs/language-tools/issues/1148#issuecomment-1094378126
			else if (ts.isSpreadAssignment(prop)) {
				// TODO: cannot report "Spread types may only be created from object types.ts(2698)"
				walkIdentifiers(ts, prop.expression, ast, cb, ctx, blockVars, false);
			}
			// fix https://github.com/vuejs/language-tools/issues/4604
			else if (ts.isFunctionLike(prop) && prop.body) {
				processFunction(ts, prop, ast, cb, ctx);
			}
		}
	}
	else if (ts.isTypeReferenceNode(node)) {
		// fix https://github.com/vuejs/language-tools/issues/1422
		ts.forEachChild(node, node => walkIdentifiersInTypeReference(ts, node, cb));
	}
	else {
		const _blockVars = blockVars;
		if (ts.isBlock(node)) {
			blockVars = [];
		}
		ts.forEachChild(node, node => walkIdentifiers(ts, node, ast, cb, ctx, blockVars, false));
		if (ts.isBlock(node)) {
			for (const varName of blockVars) {
				ctx.removeLocalVariable(varName);
			}
		}
		blockVars = _blockVars;
	}

	if (isRoot) {
		for (const varName of blockVars) {
			ctx.removeLocalVariable(varName);
		}
	}
}

function processFunction(
	ts: typeof import('typescript'),
	node: ts.ArrowFunction | ts.FunctionExpression | ts.AccessorDeclaration | ts.MethodDeclaration,
	ast: ts.SourceFile,
	cb: (varNode: ts.Identifier, isShorthand: boolean) => void,
	ctx: TemplateCodegenContext
) {
	const functionArgs: string[] = [];
	for (const param of node.parameters) {
		collectVars(ts, param.name, ast, functionArgs);
		if (param.type) {
			walkIdentifiers(ts, param.type, ast, cb, ctx);
		}
	}
	for (const varName of functionArgs) {
		ctx.addLocalVariable(varName);
	}
	if (node.body) {
		walkIdentifiers(ts, node.body, ast, cb, ctx);
	}
	for (const varName of functionArgs) {
		ctx.removeLocalVariable(varName);
	}
}

function walkIdentifiersInTypeReference(
	ts: typeof import('typescript'),
	node: ts.Node,
	cb: (varNode: ts.Identifier, isShorthand: boolean) => void
) {
	if (ts.isTypeQueryNode(node) && ts.isIdentifier(node.exprName)) {
		cb(node.exprName, false);
	}
	else {
		ts.forEachChild(node, node => walkIdentifiersInTypeReference(ts, node, cb));
	}
}

function shouldIdentifierSkipped(
	ctx: TemplateCodegenContext,
	text: string,
	destructuredPropNames: Set<string> | undefined
) {
	return ctx.hasLocalVariable(text)
		// https://github.com/vuejs/core/blob/245230e135152900189f13a4281302de45fdcfaa/packages/compiler-core/src/transforms/transformExpression.ts#L342-L352
		|| isGloballyAllowed(text)
		|| isLiteralWhitelisted(text)
		|| text === 'require'
		|| text.startsWith('__VLS_')
		|| destructuredPropNames?.has(text);
}
