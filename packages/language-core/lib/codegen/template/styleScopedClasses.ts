import * as CompilerDOM from '@vue/compiler-dom';
import type * as ts from 'typescript';
import type { Code, IRBlock } from '../../types';
import { getNodeText, normalizeAttributeValue } from '../../utils/shared';
import { codeFeatures } from '../codeFeatures';
import { names } from '../names';
import { endOfLine, forEachNode, getTypeScriptAST } from '../utils';
import { Boundary } from '../utils/boundary';
import { generateEscaped } from '../utils/escaped';
import type { TemplateCodegenOptions } from './index';

const classNameEscapeRE = /([\\'])/;

// For language-service/lib/plugins/vue-scoped-class-links.ts usage
export const references: WeakMap<IRBlock, [version: string, [className: string, offset: number][]]> = new WeakMap();

export function* generateStyleScopedClassReferences(
	{ template, typescript: ts }: TemplateCodegenOptions,
	node: CompilerDOM.ElementNode,
): Generator<Code> {
	for (const prop of node.props) {
		if (
			prop.type === CompilerDOM.NodeTypes.ATTRIBUTE
			&& prop.name === 'class'
			&& prop.value
		) {
			const [text, start] = normalizeAttributeValue(prop.value);
			for (const [className, offset] of forEachClassName(text)) {
				yield* generateStyleScopedClassReference(template, className, start + offset);
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
			const literals: ts.StringLiteralLike[] = [];

			for (const node of forEachNode(ts, ast)) {
				if (
					!ts.isExpressionStatement(node)
					|| !ts.isParenthesizedExpression(node.expression)
				) {
					continue;
				}
				const { expression } = node.expression;

				if (ts.isStringLiteralLike(expression)) {
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
					yield* generateStyleScopedClassReference(template, className, start + offset);
				}
			}

			function* walkArrayLiteral(node: ts.ArrayLiteralExpression) {
				const { elements } = node;
				for (const element of elements) {
					if (ts.isStringLiteralLike(element)) {
						literals.push(element);
					}
					else if (ts.isObjectLiteralExpression(element)) {
						yield* walkObjectLiteral(element);
					}
				}
			}

			function* walkObjectLiteral(node: ts.ObjectLiteralExpression) {
				const { properties } = node;
				for (const property of properties) {
					if (ts.isPropertyAssignment(property)) {
						const { name } = property;
						if (ts.isIdentifier(name)) {
							const text = getNodeText(ts, name, ast);
							yield* generateStyleScopedClassReference(template, text, name.end - text.length + startOffset);
						}
						else if (ts.isStringLiteral(name)) {
							literals.push(name);
						}
						else if (ts.isComputedPropertyName(name)) {
							const { expression } = name;
							if (ts.isStringLiteralLike(expression)) {
								literals.push(expression);
							}
						}
					}
					else if (ts.isShorthandPropertyAssignment(property)) {
						const text = getNodeText(ts, property.name, ast);
						yield* generateStyleScopedClassReference(template, text, property.name.end - text.length + startOffset);
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

export function* generateStyleScopedClassReference(
	block: IRBlock,
	className: string,
	offset: number,
	fullStart = offset,
): Generator<Code> {
	if (!className) {
		yield `/** @type {${names.StyleScopedClasses}['`;
		yield ['', 'template', offset, codeFeatures.completion];
		yield `']} */${endOfLine}`;
		return;
	}

	const cache = references.get(block);
	if (!cache || cache[0] !== block.content) {
		const arr: [className: string, offset: number][] = [];
		references.set(block, [block.content, arr]);
		arr.push([className, offset]);
	}
	else {
		cache[1].push([className, offset]);
	}

	yield `/** @type {${names.StyleScopedClasses}[`;
	const boundary = yield* Boundary.start(
		block.name,
		fullStart,
		offset + className.length,
		codeFeatures.navigationAndCompletion,
	);
	yield `'`;
	yield* generateEscaped(
		className,
		block.name,
		offset,
		boundary.features,
		classNameEscapeRE,
	);
	yield `'`;
	yield boundary.end();
	yield `]} */${endOfLine}`;
}
