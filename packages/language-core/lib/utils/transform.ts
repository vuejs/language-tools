import { isGloballyWhitelisted } from '@vue/shared';
import type * as ts from 'typescript';
import { getNodeText, getStartEnd } from '../parsers/scriptSetupRanges';
import type { VueCompilerOptions } from '../types';

export function* eachInterpolationSegment(
	ts: typeof import('typescript'),
	code: string,
	ast: ts.SourceFile,
	localVars: Map<string, number>,
	identifiers: Set<string>,
	vueOptions: VueCompilerOptions,
	ctxVars: {
		text: string,
		isShorthand: boolean,
		offset: number,
	}[] = []
): Generator<[fragment: string, offset: number | undefined, isJustForErrorMapping?: boolean]> {

	const varCb = (id: ts.Identifier, isShorthand: boolean) => {
		const text = getNodeText(ts, id, ast);
		if (
			localVars.get(text) ||
			// https://github.com/vuejs/core/blob/245230e135152900189f13a4281302de45fdcfaa/packages/compiler-core/src/transforms/transformExpression.ts#L342-L352
			isGloballyWhitelisted(text) ||
			text === 'require' ||
			text.startsWith('__VLS_')
		) {
			// localVarOffsets.push(localVar.getStart(ast));
		}
		else {
			ctxVars.push({
				text,
				isShorthand: isShorthand,
				offset: getStartEnd(ts, id, ast).start,
			});
			identifiers.add(text);
		}
	};
	ts.forEachChild(ast, node => walkIdentifiers(ts, node, ast, varCb, localVars));

	ctxVars = ctxVars.sort((a, b) => a.offset - b.offset);

	if (ctxVars.length) {

		if (ctxVars[0].isShorthand) {
			yield [code.substring(0, ctxVars[0].offset + ctxVars[0].text.length), 0];
			yield [': ', undefined];
		}
		else {
			yield [code.substring(0, ctxVars[0].offset), 0];
		}

		for (let i = 0; i < ctxVars.length - 1; i++) {

			// fix https://github.com/vuejs/language-tools/issues/1205
			// fix https://github.com/vuejs/language-tools/issues/1264
			yield ['', ctxVars[i + 1].offset, true];
			if (vueOptions.experimentalUseElementAccessInTemplate) {
				const varStart = ctxVars[i].offset;
				const varEnd = ctxVars[i].offset + ctxVars[i].text.length;
				yield ['__VLS_ctx[', undefined];
				yield ['', varStart, true];
				yield ["'", undefined];
				yield [code.substring(varStart, varEnd), varStart];
				yield ["'", undefined];
				yield ['', varEnd, true];
				yield [']', undefined];
				if (ctxVars[i + 1].isShorthand) {
					yield [code.substring(varEnd, ctxVars[i + 1].offset + ctxVars[i + 1].text.length), varEnd];
					yield [': ', undefined];
				}
				else {
					yield [code.substring(varEnd, ctxVars[i + 1].offset), varEnd];
				}
			}
			else {
				yield ['__VLS_ctx.', undefined];
				if (ctxVars[i + 1].isShorthand) {
					yield [code.substring(ctxVars[i].offset, ctxVars[i + 1].offset + ctxVars[i + 1].text.length), ctxVars[i].offset];
					yield [': ', undefined];
				}
				else {
					yield [code.substring(ctxVars[i].offset, ctxVars[i + 1].offset), ctxVars[i].offset];
				}
			}
		}

		if (vueOptions.experimentalUseElementAccessInTemplate) {
			const varStart = ctxVars[ctxVars.length - 1].offset;
			const varEnd = ctxVars[ctxVars.length - 1].offset + ctxVars[ctxVars.length - 1].text.length;
			yield ['__VLS_ctx[', undefined];
			yield ['', varStart, true];
			yield ["'", undefined];
			yield [code.substring(varStart, varEnd), varStart];
			yield ["'", undefined];
			yield ['', varEnd, true];
			yield [']', undefined];
			yield [code.substring(varEnd), varEnd];
		}
		else {
			yield ['', ctxVars[ctxVars.length - 1].offset, true];
			yield ['__VLS_ctx.', undefined];
			yield [code.substring(ctxVars[ctxVars.length - 1].offset), ctxVars[ctxVars.length - 1].offset];
		}
	}
	else {
		yield [code, 0];
	}
}

function walkIdentifiers(
	ts: typeof import('typescript'),
	node: ts.Node,
	ast: ts.SourceFile,
	cb: (varNode: ts.Identifier, isShorthand: boolean) => void,
	localVars: Map<string, number>,
	blockVars: string[] = [],
	isRoot: boolean = true,
) {

	if (ts.isIdentifier(node)) {
		cb(node, false);
	}
	else if (ts.isShorthandPropertyAssignment(node)) {
		cb(node.name, true);
	}
	else if (ts.isPropertyAccessExpression(node)) {
		walkIdentifiers(ts, node.expression, ast, cb, localVars, blockVars, false);
	}
	else if (ts.isVariableDeclaration(node)) {

		collectVars(ts, node.name, ast, blockVars);

		for (const varName of blockVars) {
			localVars.set(varName, (localVars.get(varName) ?? 0) + 1);
		}

		if (node.initializer) {
			walkIdentifiers(ts, node.initializer, ast, cb, localVars, blockVars, false);
		}
	}
	else if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {

		const functionArgs: string[] = [];

		for (const param of node.parameters) {
			collectVars(ts, param.name, ast, functionArgs);
			if (param.type) {
				walkIdentifiers(ts, param.type, ast, cb, localVars, blockVars, false);
			}
		}

		for (const varName of functionArgs) {
			localVars.set(varName, (localVars.get(varName) ?? 0) + 1);
		}

		walkIdentifiers(ts, node.body, ast, cb, localVars, blockVars, false);

		for (const varName of functionArgs) {
			localVars.set(varName, localVars.get(varName)! - 1);
		}
	}
	else if (ts.isObjectLiteralExpression(node)) {
		for (const prop of node.properties) {
			if (ts.isPropertyAssignment(prop)) {
				// fix https://github.com/vuejs/language-tools/issues/1176
				if (ts.isComputedPropertyName(prop.name)) {
					walkIdentifiers(ts, prop.name.expression, ast, cb, localVars, blockVars, false);
				}
				walkIdentifiers(ts, prop.initializer, ast, cb, localVars, blockVars, false);
			}
			// fix https://github.com/vuejs/language-tools/issues/1156
			else if (ts.isShorthandPropertyAssignment(prop)) {
				walkIdentifiers(ts, prop, ast, cb, localVars, blockVars, false);
			}
			// fix https://github.com/vuejs/language-tools/issues/1148#issuecomment-1094378126
			else if (ts.isSpreadAssignment(prop)) {
				// TODO: cannot report "Spread types may only be created from object types.ts(2698)"
				walkIdentifiers(ts, prop.expression, ast, cb, localVars, blockVars, false);
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
		ts.forEachChild(node, node => walkIdentifiers(ts, node, ast, cb, localVars, blockVars, false));
		if (ts.isBlock(node)) {
			for (const varName of blockVars) {
				localVars.set(varName, localVars.get(varName)! - 1);
			}
		}
		blockVars = _blockVars;
	}

	if (isRoot) {
		for (const varName of blockVars) {
			localVars.set(varName, localVars.get(varName)! - 1);
		}
	}
}

function walkIdentifiersInTypeReference(
	ts: typeof import('typescript'),
	node: ts.Node,
	cb: (varNode: ts.Identifier, isShorthand: boolean) => void,
) {
	if (ts.isTypeQueryNode(node) && ts.isIdentifier(node.exprName)) {
		cb(node.exprName, false);
	}
	else {
		ts.forEachChild(node, node => walkIdentifiersInTypeReference(ts, node, cb));
	}
}

export function collectVars(
	ts: typeof import('typescript'),
	node: ts.Node,
	ast: ts.SourceFile,
	result: string[],
) {
	if (ts.isIdentifier(node)) {
		result.push(getNodeText(ts, node, ast));
	}
	else if (ts.isObjectBindingPattern(node)) {
		for (const el of node.elements) {
			collectVars(ts, el.name, ast, result);
		}
	}
	else if (ts.isArrayBindingPattern(node)) {
		for (const el of node.elements) {
			if (ts.isBindingElement(el)) {
				collectVars(ts, el.name, ast, result);
			}
		}
	}
	else {
		ts.forEachChild(node, node => collectVars(ts, node, ast, result));
	}
}
