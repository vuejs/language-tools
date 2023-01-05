import type { TextRange } from '../types';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { getStartEnd, parseBindingRanges } from './scriptSetupRanges';

export interface ScriptRanges extends ReturnType<typeof parseScriptRanges> { }

export function parseScriptRanges(ts: typeof import('typescript/lib/tsserverlibrary'), ast: ts.SourceFile, hasScriptSetup: boolean, withNode: boolean) {

	let exportDefault: (TextRange & {
		expression: TextRange,
		args: TextRange,
		argsNode: ts.ObjectLiteralExpression | undefined,
		componentsOption: TextRange | undefined,
		componentsOptionNode: ts.ObjectLiteralExpression | undefined,
		nameOption: TextRange | undefined,
	}) | undefined;

	const bindings = hasScriptSetup ? parseBindingRanges(ts, ast, false) : [];

	ast.forEachChild(raw => {

		if (ts.isExportAssignment(raw)) {

			let node: ts.AsExpression | ts.ExportAssignment | ts.ParenthesizedExpression = raw;
			while (ts.isAsExpression(node.expression) || ts.isParenthesizedExpression(node.expression)) { // fix https://github.com/johnsoncodehk/volar/issues/1882
				node = node.expression;
			}

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
				let nameOptionNode: ts.Expression | undefined;
				obj.forEachChild(node => {
					if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name)) {
						if (node.name.escapedText === 'components' && ts.isObjectLiteralExpression(node.initializer)) {
							componentsOptionNode = node.initializer;
						}
						if (node.name.escapedText === 'name') {
							nameOptionNode = node.initializer;
						}
					}
				});
				exportDefault = {
					..._getStartEnd(raw),
					expression: _getStartEnd(node.expression),
					args: _getStartEnd(obj),
					argsNode: withNode ? obj : undefined,
					componentsOption: componentsOptionNode ? _getStartEnd(componentsOptionNode) : undefined,
					componentsOptionNode: withNode ? componentsOptionNode : undefined,
					nameOption: nameOptionNode ? _getStartEnd(nameOptionNode) : undefined,
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
