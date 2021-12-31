import type * as ts from 'typescript/lib/tsserverlibrary';
import { getStartEnd, findBindingVars } from './scriptSetupRanges';
import type { TextRange } from '../types';

export interface ScriptSetupRanges extends ReturnType<typeof parseRefSugarDeclarationRanges> { }

export function parseRefSugarDeclarationRanges(ts: typeof import('typescript/lib/tsserverlibrary'), ast: ts.SourceFile, collectKeys: string[]) {

	const calls: {
		flag: TextRange, // 'let' | 'count'
		leftBindings: TextRange[],
		rightFn: TextRange,
	}[] = [];

	ast.forEachChild(node => {
		visitNode(node);
	});

	return calls;

	function _getStartEnd(node: ts.Node) {
		return getStartEnd(node, ast);
	}
	function visitNode(node: ts.Node) {
		if (ts.isVariableDeclarationList(node) && node.declarations.length === 1) {

			const declaration = node.declarations[0];
			const left = declaration.name;
			const right = declaration.initializer;

			if (
				right
				&& ts.isCallExpression(right)
				&& ts.isIdentifier(right.expression)
			) {

				const callText = right.expression.getText(ast);

				if (collectKeys.some(key => key === callText)) {

					const flagStart = _getStartEnd(node).start;
					const flag: TextRange = {
						start: flagStart,
						end: flagStart + (node.flags === ts.NodeFlags.Const ? 'count'.length : 'let'.length),
					};
					const bindings = findBindingVars(ts, left, ast);
					const fnRange = _getStartEnd(right.expression);

					calls.push({
						flag,
						leftBindings: bindings,
						rightFn: fnRange,
					});
				}
			}
		}
		node.forEachChild(child => visitNode(child));
	}
}

export function parseRefSugarCallRanges(ts: typeof import('typescript/lib/tsserverlibrary'), ast: ts.SourceFile, collectKeys: string[]) {

	const calls: {
		fullRange: TextRange,
		argsRange: TextRange,
	}[] = [];

	ast.forEachChild(node => {
		visitNode(node);
	});

	return calls;

	function _getStartEnd(node: ts.Node) {
		return getStartEnd(node, ast);
	}
	function visitNode(node: ts.Node) {
		if (
			ts.isCallExpression(node)
			&& ts.isIdentifier(node.expression)
			&& node.arguments.length
		) {

			const callText = node.expression.getText(ast);

			if (collectKeys.some(key => key === callText)) {

				const firstArg = node.arguments[0];
				const lastArg = node.arguments[node.arguments.length - 1];

				calls.push({
					fullRange: _getStartEnd(node),
					argsRange: {
						start: firstArg.getStart(ast),
						end: lastArg.getEnd(),
					},
				});
			}
		}
		node.forEachChild(child => visitNode(child));
	}
}

export function parseDeclarationRanges(ts: typeof import('typescript/lib/tsserverlibrary'), ast: ts.SourceFile) {

	const declarations: {
		flag: TextRange, // 'let' | 'count'
		leftIsIdentifier: boolean,
		leftBindings: TextRange[],
		right: TextRange,
		rightFn: TextRange | undefined,
	}[] = [];

	ast.forEachChild(node => {
		visitNode(node);
	});

	return declarations;

	function _getStartEnd(node: ts.Node) {
		return getStartEnd(node, ast);
	}
	function visitNode(node: ts.Node) {
		if (ts.isVariableDeclarationList(node) && node.declarations.length === 1) {

			const declaration = node.declarations[0];
			const left = declaration.name;
			const right = declaration.initializer;

			if (right) {

				const flagStart = _getStartEnd(node).start;
				const flag: TextRange = {
					start: flagStart,
					end: flagStart + (node.flags === ts.NodeFlags.Const ? 'count'.length : 'let'.length),
				};
				const bindings = findBindingVars(ts, left, ast);
				let rightFn: TextRange | undefined;

				if (ts.isCallExpression(right) && ts.isIdentifier(right.expression)) {
					rightFn = _getStartEnd(right.expression);
				}

				declarations.push({
					flag,
					leftIsIdentifier: ts.isIdentifier(left),
					leftBindings: bindings,
					right: _getStartEnd(right),
					rightFn: rightFn,
				});
			}
		}
		node.forEachChild(child => visitNode(child));
	}
}

export function parseDotValueRanges(ts: typeof import('typescript/lib/tsserverlibrary'), ast: ts.SourceFile) {

	const dotValues: {
		range: TextRange,
		beforeDot: number,
	}[] = [];

	ast.forEachChild(node => {
		visitNode(node);
	});

	return dotValues;

	function _getStartEnd(node: ts.Node) {
		return getStartEnd(node, ast);
	}
	function visitNode(node: ts.Node) {
		if (
			ts.isPropertyAccessExpression(node)
			&& ts.isIdentifier(node.name)
		) {

			const text = node.name.getText(ast);

			if (text === 'value') {
				dotValues.push({
					range: _getStartEnd(node.name),
					beforeDot: node.expression.getEnd(),
				});
			}
		}
		node.forEachChild(child => visitNode(child));
	}
}
