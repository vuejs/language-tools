import type * as CompilerDOM from '@vue/compiler-dom';
import type * as ts from 'typescript/ast' with { 'resolution-mode': 'import' };
import { collectBindingNames } from '../script/bindingPatterns';
import { getUnwrappedExpression } from '../script/scriptBindings';
import type { IRTemplate, TypeScript } from '../types';
import { getStartEnd } from '../typescript/nodes';
import { getTypeScriptAST } from '../typescript/typescriptAST';

export function parseVForNode(node: CompilerDOM.ForNode) {
	const { value, key, index } = node.parseResult;
	const leftExpressionRange = (value || key || index)
		? {
			start: (value ?? key ?? index)!.loc.start.offset,
			end: (index ?? key ?? value)!.loc.end.offset,
		}
		: undefined;
	const leftExpressionText = leftExpressionRange
		? node.loc.source.slice(
			leftExpressionRange.start - node.loc.start.offset,
			leftExpressionRange.end - node.loc.start.offset,
		)
		: undefined;
	return {
		leftExpressionRange,
		leftExpressionText,
	};
}

export function parseInterpolationNode(node: CompilerDOM.InterpolationNode, template: string) {
	let start = node.content.loc.start.offset;
	let end = node.content.loc.end.offset;

	// fix https://github.com/vuejs/language-tools/issues/1787
	while (template[start - 1]?.trim() === '') {
		start--;
	}
	while (template[end]?.trim() === '') {
		end++;
	}

	return [template.slice(start, end), start] as const;
}

export function isCompoundExpression(ts: TypeScript, ast: ts.SourceFile) {
	if (ast.statements.length === 0) {
		return false;
	}
	if (ast.statements.length === 1 && ast.text[ast.endOfFileToken.pos - 1] !== ';') {
		const statement = ast.statements[0]!;
		if (ts.isExpressionStatement(statement)) {
			const node = getUnwrappedExpression(ts, statement.expression);
			if (
				ts.isArrowFunction(node)
				|| ts.isIdentifier(node)
				|| ts.isElementAccessExpression(node)
				|| ts.isPropertyAccessExpression(node)
			) {
				return false;
			}
		}
		else if (ts.isFunctionDeclaration(statement)) {
			return false;
		}
	}
	return true;
}

/**
 * The aliases of a `v-for`: the names they declare, and the ranges in `leftExpressionText` of the default values
 * of their destructuring patterns, in source order.
 */
export function parseVForAliases(ts: TypeScript, template: IRTemplate, node: CompilerDOM.ForNode) {
	const { leftExpressionRange, leftExpressionText } = parseVForNode(node);
	let bindingNames: string[] = [];
	const defaultInitializerRanges: [start: number, end: number][] = [];
	if (leftExpressionRange && leftExpressionText) {
		const wrap = `const [`;
		const ast = getTypeScriptAST(ts, template, `${wrap}${leftExpressionText}]`);
		bindingNames = collectBindingNames(ts, ast, ast);
		const declaration = (ast.statements[0] as ts.VariableStatement).declarationList.declarations[0]!;
		const initializers: ts.Expression[] = [];
		collectDefaultInitializers(ts, declaration.name, initializers);
		for (const initializer of initializers) {
			const { start, end } = getStartEnd(initializer, ast);
			defaultInitializerRanges.push([start - wrap.length, end - wrap.length]);
		}
		defaultInitializerRanges.sort((a, b) => a[0] - b[0]);
	}
	return { leftExpressionRange, leftExpressionText, bindingNames, defaultInitializerRanges };
}

/** The default values in the destructuring pattern of a `v-for` alias. */
function collectDefaultInitializers(
	ts: TypeScript,
	pattern: ts.BindingName,
	out: ts.Expression[],
) {
	if (ts.isIdentifier(pattern)) {
		return;
	}
	for (const element of pattern.elements) {
		if (!ts.isBindingElement(element)) {
			continue;
		}
		if (element.name && !ts.isIdentifier(element.name)) {
			collectDefaultInitializers(ts, element.name, out);
		}
		if (element.initializer) {
			out.push(element.initializer);
		}
	}
}
