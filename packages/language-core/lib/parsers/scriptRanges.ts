import type * as ts from 'typescript';
import type { TextRange } from '../types';
import { getNodeText, getStartEnd } from '../utils/shared';
import { parseBindingRanges } from './scriptSetupRanges';

export interface ScriptRanges extends ReturnType<typeof parseScriptRanges> { }

export function parseScriptRanges(ts: typeof import('typescript'), ast: ts.SourceFile, hasScriptSetup: boolean, withNode: boolean) {

	let exportDefault: (TextRange & {
		expression: TextRange,
		args: TextRange,
		argsNode: ts.ObjectLiteralExpression | undefined,
		componentsOption: TextRange | undefined,
		componentsOptionNode: ts.ObjectLiteralExpression | undefined,
		directivesOption: TextRange | undefined,
		nameOption: TextRange | undefined,
		inheritAttrsOption: string | undefined,
	}) | undefined;
	let classBlockEnd: number | undefined;

	const bindings = hasScriptSetup ? parseBindingRanges(ts, ast) : [];

	ts.forEachChild(ast, raw => {

		if (ts.isExportAssignment(raw)) {

			let node: ts.AsExpression | ts.ExportAssignment | ts.ParenthesizedExpression = raw;
			while (isAsExpression(node.expression) || ts.isParenthesizedExpression(node.expression)) { // fix https://github.com/vuejs/language-tools/issues/1882
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
				let directivesOptionNode: ts.ObjectLiteralExpression | undefined;
				let nameOptionNode: ts.Expression | undefined;
				let inheritAttrsOption: string | undefined;
				ts.forEachChild(obj, node => {
					if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name)) {
						const name = _getNodeText(node.name);
						if (name === 'components' && ts.isObjectLiteralExpression(node.initializer)) {
							componentsOptionNode = node.initializer;
						}
						else if (name === 'directives' && ts.isObjectLiteralExpression(node.initializer)) {
							directivesOptionNode = node.initializer;
						}
						else if (name === 'name') {
							nameOptionNode = node.initializer;
						}
						else if (name === 'inheritAttrs') {
							inheritAttrsOption = _getNodeText(node.initializer);
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
					directivesOption: directivesOptionNode ? _getStartEnd(directivesOptionNode) : undefined,
					nameOption: nameOptionNode ? _getStartEnd(nameOptionNode) : undefined,
					inheritAttrsOption,
				};
			}
		}

		if (
			ts.isClassDeclaration(raw)
			&& raw.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword)
			&& raw.modifiers?.some(mod => mod.kind === ts.SyntaxKind.DefaultKeyword)
		) {
			classBlockEnd = raw.end - 1;
		}
	});

	return {
		exportDefault,
		classBlockEnd,
		bindings,
	};

	function _getStartEnd(node: ts.Node) {
		return getStartEnd(ts, node, ast);
	}

	function _getNodeText(node: ts.Node) {
		return getNodeText(ts, node, ast);
	}

	// isAsExpression is missing in tsc
	function isAsExpression(node: ts.Node): node is ts.AsExpression {
		return node.kind === ts.SyntaxKind.AsExpression;
	}
}
