import type * as ts from 'typescript';
import type { TextRange, VueCompilerOptions } from '../types';
import { getNodeText, getStartEnd } from '../utils/shared';
import { getClosestMultiLineCommentRange, parseBindingRanges } from './utils';

export interface ScriptRanges extends ReturnType<typeof parseScriptRanges> {}

export function parseScriptRanges(
	ts: typeof import('typescript'),
	sourceFile: ts.SourceFile,
	vueCompilerOptions: VueCompilerOptions,
) {
	let exportDefault:
		| TextRange & {
			expression: TextRange<ts.Expression>;
			isObjectLiteral: boolean;
			options?: {
				isObjectLiteral: boolean;
				expression: TextRange;
				args: TextRange<ts.ObjectLiteralExpression>;
				components: TextRange<ts.ObjectLiteralExpression> | undefined;
				directives: TextRange | undefined;
				name: TextRange<ts.StringLiteral> | undefined;
				inheritAttrs: string | undefined;
			};
		}
		| undefined;

	const { bindings, components } = parseBindingRanges(ts, sourceFile, vueCompilerOptions.extensions);

	ts.forEachChild(sourceFile, child => {
		if (ts.isExportAssignment(child)) {
			exportDefault = {
				...getStartEnd(ts, child, sourceFile),
				expression: getStartEnd(ts, child.expression, sourceFile),
				isObjectLiteral: ts.isObjectLiteralExpression(child.expression),
				options: parseOptionsFromExtression(ts, child.expression, sourceFile),
			};
			const comment = getClosestMultiLineCommentRange(ts, child, [], sourceFile);
			if (comment) {
				exportDefault.start = comment.start;
			}
		}
	});

	return {
		exportDefault,
		bindings,
		components,
	};
}

export function parseOptionsFromExtression(
	ts: typeof import('typescript'),
	exp: ts.Node,
	sourceFile: ts.SourceFile,
) {
	let obj: ts.ObjectLiteralExpression | undefined;

	while (isAsExpression(ts, exp) || ts.isParenthesizedExpression(exp)) { // fix https://github.com/vuejs/language-tools/issues/1882
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
		let nameOptionNode: ts.StringLiteral | undefined;
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
				else if (name === 'name' && ts.isStringLiteral(node.initializer)) {
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

	function _getStartEnd<T extends ts.Node>(node: T): TextRange<T> {
		return getStartEnd(ts, node, sourceFile);
	}

	function _getNodeText(node: ts.Node) {
		return getNodeText(ts, node, sourceFile);
	}
}

// isAsExpression is missing in tsc
function isAsExpression(ts: typeof import('typescript'), node: ts.Node): node is ts.AsExpression {
	return node.kind === ts.SyntaxKind.AsExpression;
}
