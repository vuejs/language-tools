import type * as ts from 'typescript';
import type { TextRange } from '../types';
import { getNodeText, getStartEnd } from '../utils/shared';
import { getClosestMultiLineCommentRange, parseBindingRanges } from './utils';

export interface ScriptRanges extends ReturnType<typeof parseScriptRanges> {}

export function parseScriptRanges(ts: typeof import('typescript'), ast: ts.SourceFile, hasScriptSetup: boolean) {
	let exportDefault:
		| TextRange & {
			expression: TextRange;
		}
		| undefined;
	let componentOptions:
		| {
			expression: TextRange;
			args: TextRange;
			argsNode: ts.ObjectLiteralExpression;
			components: TextRange | undefined;
			componentsNode: ts.ObjectLiteralExpression | undefined;
			directives: TextRange | undefined;
			name: TextRange | undefined;
			inheritAttrs: string | undefined;
			expose: TextRange | undefined;
		}
		| undefined;

	const bindings = hasScriptSetup ? parseBindingRanges(ts, ast) : [];

	ts.forEachChild(ast, raw => {
		if (ts.isExportAssignment(raw)) {
			exportDefault = {
				..._getStartEnd(raw),
				expression: _getStartEnd(raw.expression),
			};
			const comment = getClosestMultiLineCommentRange(ts, raw, [], ast);
			if (comment) {
				exportDefault.start = comment.start;
			}

			let node: ts.AsExpression | ts.ExportAssignment | ts.ParenthesizedExpression = raw;
			while (isAsExpression(node.expression) || ts.isParenthesizedExpression(node.expression)) { // fix https://github.com/vuejs/language-tools/issues/1882
				node = node.expression;
			}

			let obj: ts.ObjectLiteralExpression | undefined;
			if (ts.isObjectLiteralExpression(node.expression)) {
				obj = node.expression;
			}
			else if (ts.isCallExpression(node.expression) && node.expression.arguments.length) {
				const arg0 = node.expression.arguments[0]!;
				if (ts.isObjectLiteralExpression(arg0)) {
					obj = arg0;
				}
			}
			if (obj) {
				let componentsOptionNode: ts.ObjectLiteralExpression | undefined;
				let directivesOptionNode: ts.ObjectLiteralExpression | undefined;
				let nameOptionNode: ts.Expression | undefined;
				let inheritAttrsOption: string | undefined;
				let exposeOptionNode: ts.Expression | undefined;
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
						else if (name === 'expose') {
							exposeOptionNode = node.initializer;
						}
					}
				});
				componentOptions = {
					expression: _getStartEnd(node.expression),
					args: _getStartEnd(obj),
					argsNode: obj,
					components: componentsOptionNode ? _getStartEnd(componentsOptionNode) : undefined,
					componentsNode: componentsOptionNode,
					directives: directivesOptionNode ? _getStartEnd(directivesOptionNode) : undefined,
					name: nameOptionNode ? _getStartEnd(nameOptionNode) : undefined,
					inheritAttrs: inheritAttrsOption,
					expose: exposeOptionNode ? _getStartEnd(exposeOptionNode) : undefined,
				};
			}
		}
	});

	return {
		exportDefault,
		componentOptions,
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
