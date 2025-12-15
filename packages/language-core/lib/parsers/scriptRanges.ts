import type * as ts from 'typescript';
import { names } from '../..';
import type { TextRange, VueCompilerOptions } from '../types';
import { getNodeText, getStartEnd } from '../utils/shared';
import { getClosestMultiLineCommentRange, parseBindingRanges } from './utils';

export interface ScriptRanges extends ReturnType<typeof parseScriptRanges> {}

export function parseScriptRanges(
	ts: typeof import('typescript'),
	sourceFile: ts.SourceFile,
	vueCompilerOptions: VueCompilerOptions,
) {
	const _exports: Record<
		'default' | string,
		TextRange & {
			expression: TextRange<ts.Expression>;
			isObjectLiteral: boolean;
			options?: {
				isObjectLiteral: boolean;
				expression: TextRange;
				args: TextRange<ts.ObjectLiteralExpression>;
				components: TextRange<ts.ObjectLiteralExpression> | undefined;
				directives: TextRange | undefined;
				name: TextRange | undefined;
				inheritAttrs: string | undefined;
			};
		} | undefined
	> = {};

	const { bindings, components } = parseBindingRanges(ts, sourceFile, vueCompilerOptions.extensions);

	ts.forEachChild(sourceFile, child => {
		// export default ...
		if (ts.isExportAssignment(child)) {
			_exports.default = {
				..._getStartEnd(child),
				expression: _getStartEnd(child.expression),
				isObjectLiteral: ts.isObjectLiteralExpression(child.expression),
				options: getOptions(child.expression),
			};
			const comment = getClosestMultiLineCommentRange(ts, child, [], sourceFile);
			if (comment) {
				_exports.default.start = comment.start;
			}

			// const __VLS_export = ...
			const expressionText = sourceFile.text.slice(_exports.default.expression.start, _exports.default.expression.end);
			if (expressionText.includes(names._export)) {
				let exportExp: ts.Expression | undefined;
				ts.forEachChild(sourceFile, child2 => {
					if (ts.isVariableStatement(child2)) {
						for (const decl of child2.declarationList.declarations) {
							if (!ts.isIdentifier(decl.name)) {
								continue;
							}
							if (getNodeText(ts, decl.name, sourceFile) === names._export && decl.initializer) {
								exportExp = decl.initializer;
							}
						}
					}
				});
				if (exportExp) {
					_exports.default.expression = _getStartEnd(exportExp);
					_exports.default.isObjectLiteral = ts.isObjectLiteralExpression(exportExp);
					_exports.default.options = getOptions(exportExp);
				}
			}
		}

		// export const Foo = ...
		if (ts.isVariableStatement(child) && child.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
			for (const decl of child.declarationList.declarations) {
				if (!ts.isIdentifier(decl.name)) {
					continue;
				}
				const exportVar = getNodeText(ts, decl.name, sourceFile);
				let node = decl.initializer;
				if (!node) {
					continue;
				}
				_exports[exportVar] = {
					..._getStartEnd(decl),
					expression: _getStartEnd(node),
					isObjectLiteral: ts.isObjectLiteralExpression(node),
					options: getOptions(node),
				};
			}
		}
	});

	return {
		exports: _exports,
		bindings,
		components,
	};

	function getOptions(exp: ts.Node) {
		let obj: ts.ObjectLiteralExpression | undefined;

		while (isAsExpression(exp) || ts.isParenthesizedExpression(exp)) { // fix https://github.com/vuejs/language-tools/issues/1882
			exp = exp.expression;
		}

		if (ts.isObjectLiteralExpression(exp)) {
			obj = exp;
		}
		else if (ts.isCallExpression(exp) && exp.arguments.length) {
			const arg0 = exp.arguments[0]!;
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
			return {
				isObjectLiteral: ts.isObjectLiteralExpression(exp),
				expression: _getStartEnd(exp),
				args: _getStartEnd(obj),
				argsNode: obj,
				components: componentsOptionNode ? _getStartEnd(componentsOptionNode) : undefined,
				componentsNode: componentsOptionNode,
				directives: directivesOptionNode ? _getStartEnd(directivesOptionNode) : undefined,
				name: nameOptionNode ? _getStartEnd(nameOptionNode) : undefined,
				nameNode: nameOptionNode,
				inheritAttrs: inheritAttrsOption,
			};
		}
	}

	function _getStartEnd<T extends ts.Node>(node: T): TextRange<T> {
		return getStartEnd(ts, node, sourceFile);
	}

	function _getNodeText(node: ts.Node) {
		return getNodeText(ts, node, sourceFile);
	}

	// isAsExpression is missing in tsc
	function isAsExpression(node: ts.Node): node is ts.AsExpression {
		return node.kind === ts.SyntaxKind.AsExpression;
	}
}
