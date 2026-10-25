import { SpanMapKind } from '@volar/language-core';
import * as CompilerDOM from '@vue/compiler-dom';
import type * as ts from 'typescript/ast' with { 'resolution-mode': 'import' };
import { forEachNode, getTypeScriptAST } from '../codegen/utils';
import type { IRBlock, TypeScript } from '../types';
import { getNodeText, isStringLiteralLike, normalizeAttributeValue } from './shared';

export type StyleScopedClassReference = [
	className: string,
	offset: number,
	fullStart: number,
	kind: SpanMapKind | undefined,
];

/**
 * The class names an element refers to through its static `class` attribute
 * and the literals of its `:class` binding, at template offsets.
 * Empty class names (from repeated spaces) are included.
 */
export function* forEachStyleScopedClassReference(
	ts: TypeScript,
	template: IRBlock,
	node: CompilerDOM.ElementNode,
): Generator<StyleScopedClassReference> {
	for (const prop of node.props) {
		if (
			prop.type === CompilerDOM.NodeTypes.ATTRIBUTE
			&& prop.name === 'class'
			&& prop.value
		) {
			const [text, start] = normalizeAttributeValue(prop.value);
			for (const [className, offset] of forEachClassName(text)) {
				yield [className, start + offset, start + offset, undefined];
			}
		}
		else if (
			prop.type === CompilerDOM.NodeTypes.DIRECTIVE
			&& prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
			&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
			&& prop.arg.content === 'class'
		) {
			const content = '(' + prop.exp.content + ')';
			const startOffset = prop.exp.loc.start.offset - 1;
			const ast = getTypeScriptAST(ts, template, content);
			const literals: (ts.StringLiteral | ts.NoSubstitutionTemplateLiteral)[] = [];

			for (const node of forEachNode(ast)) {
				if (
					!ts.isExpressionStatement(node)
					|| !ts.isParenthesizedExpression(node.expression)
				) {
					continue;
				}
				const { expression } = node.expression;

				if (isStringLiteralLike(ts, expression)) {
					literals.push(expression);
				}
				else if (ts.isArrayLiteralExpression(expression)) {
					yield* walkArrayLiteral(expression);
				}
				else if (ts.isObjectLiteralExpression(expression)) {
					yield* walkObjectLiteral(expression);
				}
			}

			for (const literal of literals) {
				const start = literal.end - literal.text.length - 1 + startOffset;
				for (const [className, offset] of forEachClassName(literal.text)) {
					yield [className, start + offset, start + offset, undefined];
				}
			}

			function* walkArrayLiteral(node: ts.ArrayLiteralExpression): Generator<StyleScopedClassReference> {
				const { elements } = node;
				for (const element of elements) {
					if (isStringLiteralLike(ts, element)) {
						literals.push(element);
					}
					else if (ts.isObjectLiteralExpression(element)) {
						yield* walkObjectLiteral(element);
					}
				}
			}

			function* walkObjectLiteral(node: ts.ObjectLiteralExpression): Generator<StyleScopedClassReference> {
				const { properties } = node;
				for (const property of properties) {
					if (ts.isPropertyAssignment(property)) {
						const { name } = property;
						if (ts.isIdentifier(name)) {
							const text = getNodeText(name, ast);
							const offset = name.end - text.length + startOffset;
							yield [text, offset, offset, undefined];
						}
						else if (ts.isStringLiteral(name)) {
							literals.push(name);
						}
						else if (ts.isComputedPropertyName(name)) {
							const { expression } = name;
							if (isStringLiteralLike(ts, expression)) {
								literals.push(expression);
							}
						}
					}
					else if (ts.isShorthandPropertyAssignment(property)) {
						const text = getNodeText(property.name, ast);
						const offset = property.name.end - text.length + startOffset;
						// the name is also the value, which maps to it
						yield [text, offset, offset, SpanMapKind.Atom];
					}
				}
			}
		}
	}
}

function* forEachClassName(content: string) {
	let offset = 0;
	for (const className of content.split(' ')) {
		yield [className, offset] as const;
		offset += className.length + 1;
	}
}
