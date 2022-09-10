import type { TextRange } from '@volar/language-core';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { getStartEnd, parseBindingRanges } from './scriptSetupRanges';

export interface ScriptRanges extends ReturnType<typeof parseScriptRanges> { }

export function parseScriptRanges(ts: typeof import('typescript/lib/tsserverlibrary'), ast: ts.SourceFile, hasScriptSetup: boolean, withComponentOption: boolean, withNode: boolean) {

	let exportDefault: (TextRange & {
		expression: TextRange,
		args: TextRange,
		argsNode: ts.ObjectLiteralExpression | undefined,
		componentsOption: TextRange | undefined,
		componentsOptionNode: ts.ObjectLiteralExpression | undefined,
	}) | undefined;

	const bindings = hasScriptSetup ? parseBindingRanges(ts, ast, false) : [];

	ast.forEachChild(node => {
		if (ts.isExportAssignment(node)) {
			let obj: ts.ObjectLiteralExpression | undefined;
			if (ts.isObjectLiteralExpression(node.expression)) {
				obj = node.expression;
			}
			else if (ts.isCallExpression(node.expression) && node.expression.arguments.length) {
				const arg0 = node.expression.arguments[0];
				if (ts.isObjectLiteralExpression(arg0)) {
					obj = arg0;
				}
			}
			if (obj) {
				let componentsOptionNode: ts.ObjectLiteralExpression | undefined;
				if (withComponentOption) {
					obj.forEachChild(node => {
						if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name)) {
							if (node.name.escapedText === 'components' && ts.isObjectLiteralExpression(node.initializer)) {
								componentsOptionNode = node.initializer;
							}
						}
					});
				}
				exportDefault = {
					..._getStartEnd(node),
					expression: _getStartEnd(node.expression),
					args: _getStartEnd(obj),
					argsNode: withNode ? obj : undefined,
					componentsOption: componentsOptionNode ? _getStartEnd(componentsOptionNode) : undefined,
					componentsOptionNode: withNode ? componentsOptionNode : undefined,
				};
			}
		}
	});

	return {
		exportDefault,
		bindings,
	};

	function _getStartEnd(node: ts.Node) {
		return getStartEnd(node, ast);
	}
}
