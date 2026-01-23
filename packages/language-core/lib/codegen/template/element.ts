import * as CompilerDOM from '@vue/compiler-dom';
import { camelize, capitalize } from '@vue/shared';
import { toString } from 'muggle-string';
import type * as ts from 'typescript';
import type { Code } from '../../types';
import { getElementTagOffsets, getNodeText, hyphenateTag, normalizeAttributeValue } from '../../utils/shared';
import { codeFeatures } from '../codeFeatures';
import { createVBindShorthandInlayHintInfo } from '../inlayHints';
import * as names from '../names';
import { endOfLine, forEachNode, getTypeScriptAST, identifierRegex, newLine } from '../utils';
import { endBoundary, startBoundary } from '../utils/boundary';
import { generateCamelized } from '../utils/camelized';
import { generateStringLiteralKey } from '../utils/stringLiteralKey';
import type { TemplateCodegenContext } from './context';
import { generateElementDirectives } from './elementDirectives';
import { generateElementEvents } from './elementEvents';
import { type FailGeneratedExpression, generateElementProps } from './elementProps';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generatePropertyAccess } from './propertyAccess';
import { generateStyleScopedClassReference } from './styleScopedClasses';
import { generateTemplateChild } from './templateChild';
import { generateVSlot } from './vSlot';

export function* generateComponent(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
): Generator<Code> {
	let { tag, props } = node;
	let [startTagOffset, endTagOffset] = getElementTagOffsets(node, options.template);
	let isExpression = false;
	let isIsShorthand = false;

	if (tag.includes('.')) {
		isExpression = true;
	}
	else if (tag === 'component') {
		for (const prop of node.props) {
			if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& prop.name === 'bind'
				&& prop.arg?.loc.source === 'is'
				&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
			) {
				isIsShorthand = prop.arg.loc.end.offset === prop.exp.loc.end.offset;
				if (isIsShorthand) {
					ctx.inlayHints.push(createVBindShorthandInlayHintInfo(prop.exp.loc, 'is'));
				}
				isExpression = true;
				tag = prop.exp.content;
				startTagOffset = prop.exp.loc.start.offset;
				endTagOffset = undefined;
				props = props.filter(p => p !== prop);
				break;
			}
		}
	}

	const componentVar = ctx.getInternalVariable();

	if (isExpression) {
		yield `const ${componentVar} = `;
		yield* generateInterpolation(
			options,
			ctx,
			options.template,
			isIsShorthand
				? codeFeatures.withoutHighlightAndCompletion
				: codeFeatures.all,
			tag,
			startTagOffset,
			`(`,
			`)`,
		);
		if (endTagOffset !== undefined) {
			yield ` || `;
			yield* generateInterpolation(
				options,
				ctx,
				options.template,
				codeFeatures.withoutCompletion,
				tag,
				endTagOffset,
				`(`,
				`)`,
			);
		}
		yield `${endOfLine}`;
	}
	else {
		const originalNames = new Set([
			capitalize(camelize(tag)),
			camelize(tag),
			tag,
		]);
		const matchedSetupConst = [...originalNames].find(name => options.setupConsts.has(name));
		if (matchedSetupConst) {
			// navigation & auto import support
			yield `const ${componentVar} = `;
			yield* generateCamelized(
				matchedSetupConst[0]! + tag.slice(1),
				'template',
				startTagOffset,
				{
					...codeFeatures.withoutHighlightAndCompletion,
					...codeFeatures.importCompletionOnly,
				},
			);
			if (endTagOffset !== undefined) {
				yield ` || `;
				yield* generateCamelized(
					matchedSetupConst[0]! + tag.slice(1),
					'template',
					endTagOffset,
					codeFeatures.withoutHighlightAndCompletion,
				);
			}
			yield endOfLine;
		}
		else {
			yield `let ${componentVar}!: __VLS_WithComponent<'${tag}', __VLS_LocalComponents, __VLS_GlobalComponents`;
			yield originalNames.has(options.componentName)
				? `, typeof ${names._export}`
				: `, void`;
			for (const name of originalNames) {
				yield `, '${name}'`;
			}
			yield `>[`;
			yield* generateStringLiteralKey(
				tag,
				startTagOffset,
				{
					...codeFeatures.semanticWithoutHighlight,
					...options.vueCompilerOptions.checkUnknownComponents
						? codeFeatures.verification
						: codeFeatures.doNotReportTs2339AndTs2551,
				},
			);
			yield `]${endOfLine}`;

			if (identifierRegex.test(camelize(tag))) {
				// navigation support
				yield `/** @ts-ignore @type {typeof ${names.components}.`;
				yield* generateCamelized(tag, 'template', startTagOffset, codeFeatures.navigation);
				if (tag[0] !== tag[0]!.toUpperCase()) {
					yield ` | typeof ${names.components}.`;
					yield* generateCamelized(capitalize(tag), 'template', startTagOffset, codeFeatures.navigation);
				}
				if (endTagOffset !== undefined) {
					yield ` | typeof ${names.components}.`;
					yield* generateCamelized(tag, 'template', endTagOffset, codeFeatures.navigation);
					if (tag[0] !== tag[0]!.toUpperCase()) {
						yield ` | typeof ${names.components}.`;
						yield* generateCamelized(capitalize(tag), 'template', endTagOffset, codeFeatures.navigation);
					}
				}
				yield `} */${newLine}`;
				// auto import support
				yield* generateCamelized(tag, 'template', startTagOffset, codeFeatures.importCompletionOnly);
				yield endOfLine;
			}
		}
	}

	yield* generateComponentBody(options, ctx, node, tag, startTagOffset, props, componentVar);
}

function* generateComponentBody(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
	tag: string,
	tagOffset: number,
	props: (CompilerDOM.AttributeNode | CompilerDOM.DirectiveNode)[],
	componentVar: string,
): Generator<Code> {
	let isCtxVarUsed = false;
	let isPropsVarUsed = false;

	const getCtxVar = () => (isCtxVarUsed = true, ctxVar);
	const getPropsVar = () => (isPropsVarUsed = true, propsVar);
	ctx.components.push(getCtxVar);

	const failGeneratedExpressions: FailGeneratedExpression[] = [];
	const propCodes = [...generateElementProps(
		options,
		ctx,
		node,
		props,
		options.vueCompilerOptions.checkUnknownProps,
		failGeneratedExpressions,
	)];
	const functionalVar = ctx.getInternalVariable();
	const vNodeVar = ctx.getInternalVariable();
	const ctxVar = ctx.getInternalVariable();
	const propsVar = ctx.getInternalVariable();

	yield `// @ts-ignore${newLine}`;
	yield `const ${functionalVar} = ${
		options.vueCompilerOptions.checkUnknownProps ? '__VLS_asFunctionalComponent0' : '__VLS_asFunctionalComponent1'
	}(${componentVar}, new ${componentVar}({${newLine}`;
	yield toString(propCodes);
	yield `}))${endOfLine}`;

	yield `const `;
	const token = yield* startBoundary('template', node.loc.start.offset, codeFeatures.doNotReportTs6133);
	yield vNodeVar;
	yield endBoundary(token, node.loc.end.offset);
	yield ` = ${functionalVar}`;

	if (ctx.currentInfo.generic) {
		const { content, offset } = ctx.currentInfo.generic;
		const token = yield* startBoundary('template', offset, codeFeatures.verification);
		yield `<`;
		yield [content, 'template', offset, codeFeatures.all];
		yield `>`;
		yield endBoundary(token, offset + content.length);
	}

	yield `(`;
	const token2 = yield* startBoundary('template', tagOffset, codeFeatures.verification);
	yield `{${newLine}`;
	yield* propCodes;
	yield `}`;
	yield endBoundary(token2, tagOffset + tag.length);
	yield `, ...__VLS_functionalComponentArgsRest(${functionalVar}))${endOfLine}`;

	yield* generateFailedExpressions(options, ctx, failGeneratedExpressions);
	yield* generateElementEvents(
		options,
		ctx,
		node,
		componentVar,
		getCtxVar,
		getPropsVar,
	);
	yield* generateElementDirectives(options, ctx, node);

	const templateRef = getTemplateRef(node);
	const isRootNode = ctx.singleRootNodes.has(node)
		&& !options.vueCompilerOptions.fallthroughComponentNames.includes(hyphenateTag(tag));

	if (templateRef || isRootNode) {
		const componentInstanceVar = ctx.getInternalVariable();
		yield `var ${componentInstanceVar} = {} as (Parameters<NonNullable<typeof ${getCtxVar()}['expose']>>[0] | null)`;
		if (ctx.inVFor) {
			yield `[]`;
		}
		yield endOfLine;

		if (templateRef) {
			const typeExp = `typeof ${ctx.getHoistVariable(componentInstanceVar)}`;
			ctx.addTemplateRef(templateRef[0], typeExp, templateRef[1]);
		}
		if (isRootNode) {
			ctx.singleRootElTypes.add(`NonNullable<typeof ${componentInstanceVar}>['$el']`);
		}
	}

	if (hasVBindAttrs(options, ctx, node)) {
		ctx.inheritedAttrVars.add(getPropsVar());
	}

	yield* generateStyleScopedClassReferences(options, node);

	const slotDir = node.props.find(p => p.type === CompilerDOM.NodeTypes.DIRECTIVE && p.name === 'slot') as
		| CompilerDOM.DirectiveNode
		| undefined;
	if (slotDir || node.children.length) {
		yield* generateVSlot(options, ctx, node, slotDir, getCtxVar());
	}

	if (isCtxVarUsed) {
		yield `var ${ctxVar}!: __VLS_FunctionalComponentCtx<typeof ${componentVar}, typeof ${vNodeVar}>${endOfLine}`;
	}
	if (isPropsVarUsed) {
		yield `var ${propsVar}!: __VLS_FunctionalComponentProps<typeof ${componentVar}, typeof ${vNodeVar}>${endOfLine}`;
	}
	ctx.components.pop();
}

export function* generateElement(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
): Generator<Code> {
	const [startTagOffset, endTagOffset] = getElementTagOffsets(node, options.template);
	const failedPropExps: FailGeneratedExpression[] = [];

	yield `${
		options.vueCompilerOptions.checkUnknownProps ? `__VLS_asFunctionalElement0` : `__VLS_asFunctionalElement1`
	}(${names.intrinsics}`;
	yield* generatePropertyAccess(
		options,
		ctx,
		node.tag,
		startTagOffset,
		codeFeatures.withoutHighlightAndCompletion,
	);
	if (endTagOffset !== undefined) {
		yield `, `;
		yield names.intrinsics;
		yield* generatePropertyAccess(
			options,
			ctx,
			node.tag,
			endTagOffset,
			codeFeatures.withoutHighlightAndCompletion,
		);
	}
	yield `)(`;
	const token = yield* startBoundary('template', startTagOffset, codeFeatures.verification);
	yield `{${newLine}`;
	yield* generateElementProps(
		options,
		ctx,
		node,
		node.props,
		options.vueCompilerOptions.checkUnknownProps,
		failedPropExps,
	);
	yield `}`;
	yield endBoundary(token, startTagOffset + node.tag.length);
	yield `)${endOfLine}`;

	yield* generateFailedExpressions(options, ctx, failedPropExps);
	yield* generateElementDirectives(options, ctx, node);

	const templateRef = getTemplateRef(node);
	if (templateRef) {
		let typeExp = `__VLS_Elements['${node.tag}']`;
		if (ctx.inVFor) {
			typeExp += `[]`;
		}
		ctx.addTemplateRef(templateRef[0], typeExp, templateRef[1]);
	}
	if (ctx.singleRootNodes.has(node)) {
		ctx.singleRootElTypes.add(`__VLS_Elements['${node.tag}']`);
	}

	if (hasVBindAttrs(options, ctx, node)) {
		ctx.inheritedAttrVars.add(`__VLS_intrinsics.${node.tag}`);
	}

	yield* generateStyleScopedClassReferences(options, node);

	for (const child of node.children) {
		yield* generateTemplateChild(options, ctx, child);
	}
}

function* generateStyleScopedClassReferences(
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

function* generateFailedExpressions(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	failGeneratedExpressions: FailGeneratedExpression[],
): Generator<Code> {
	for (const failedExp of failGeneratedExpressions) {
		yield* generateInterpolation(
			options,
			ctx,
			options.template,
			codeFeatures.all,
			failedExp.node.loc.source,
			failedExp.node.loc.start.offset,
			failedExp.prefix,
			failedExp.suffix,
		);
		yield endOfLine;
	}
}

function getTemplateRef(node: CompilerDOM.ElementNode) {
	for (const prop of node.props) {
		if (
			prop.type === CompilerDOM.NodeTypes.ATTRIBUTE
			&& prop.name === 'ref'
			&& prop.value
		) {
			return normalizeAttributeValue(prop.value);
		}
	}
}

function hasVBindAttrs(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
) {
	return options.vueCompilerOptions.fallthroughAttributes && (
		(options.inheritAttrs && ctx.singleRootNodes.has(node))
		|| node.props.some(prop =>
			prop.type === CompilerDOM.NodeTypes.DIRECTIVE
			&& prop.name === 'bind'
			&& prop.exp?.loc.source === '$attrs'
		)
	);
}
